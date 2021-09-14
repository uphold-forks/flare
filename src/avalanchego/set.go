// (c) 2021, Flare Networks Limited. All rights reserved.
//
// This file is a derived work, based on the avalanchego library whose original
// notice appears below. It is distributed under a license compatible with the
// licensing terms of the original code from which it is derived.
// Please see the file LICENSE_AVALABS for licensing terms of the original work.
// Please see the file LICENSE for licensing terms.
//
// (c) 2019-2020, Ava Labs, Inc. All rights reserved.

package validators

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"strings"
	"sync"

	"github.com/ava-labs/avalanchego/ids"
	"github.com/ava-labs/avalanchego/utils/constants"
	"github.com/ava-labs/avalanchego/utils/formatting"
	"github.com/ava-labs/avalanchego/utils/sampler"

	safemath "github.com/ava-labs/avalanchego/utils/math"
)

const (
	// If, when the validator set is reset, cap(set)/len(set) > MaxExcessCapacityFactor,
	// the underlying arrays' capacities will be reduced by a factor of capacityReductionFactor.
	// Higher value for maxExcessCapacityFactor --> less aggressive array downsizing --> less memory allocations
	// but more unnecessary data in the underlying array that can't be garbage collected.
	// Higher value for capacityReductionFactor --> more aggressive array downsizing --> more memory allocations
	// but less unnecessary data in the underlying array that can't be garbage collected.
	maxExcessCapacityFactor = 4
	capacityReductionFactor = 2
)

// Set of validators that can be sampled
type Set interface {
	fmt.Stringer

	// Set removes all the current validators and adds all the provided
	// validators to the set.
	Set([]Validator) error

	// AddWeight to a staker.
	AddWeight(ids.ShortID, uint64) error

	// GetWeight retrieves the validator weight from the set.
	GetWeight(ids.ShortID) (uint64, bool)

	// SubsetWeight returns the sum of the weights of the validators.
	SubsetWeight(ids.ShortSet) (uint64, error)

	// RemoveWeight from a staker.
	RemoveWeight(ids.ShortID, uint64) error

	// Contains returns true if there is a validator with the specified ID
	// currently in the set.
	Contains(ids.ShortID) bool

	// Len returns the number of validators currently in the set.
	Len() int

	// List all the validators in this group
	List() []Validator

	// Weight returns the cumulative weight of all validators in the set.
	Weight() uint64

	// Sample returns a collection of validators, potentially with duplicates.
	// If sampling the requested size isn't possible, an error will be returned.
	Sample(size int) ([]Validator, error)

	// MaskValidator hides the named validator from future samplings
	MaskValidator(ids.ShortID) error

	// RevealValidator ensures the named validator is not hidden from future
	// samplings
	RevealValidator(ids.ShortID) error
}

// NewSet returns a new, empty set of validators.
func NewSet() Set {
	return &set{
		vdrMap:  make(map[ids.ShortID]int),
		sampler: sampler.NewWeightedWithoutReplacement(),
	}
}

// NewBestSet returns a new, empty set of validators.
func NewBestSet(expectedSampleSize int) Set {
	return &set{
		vdrMap:  make(map[ids.ShortID]int),
		sampler: sampler.NewBestWeightedWithoutReplacement(expectedSampleSize),
	}
}

// set of validators. Validator function results are cached. Therefore, to
// update a validators weight, one should ensure to call add with the updated
// validator.
type set struct {
	initialized      bool
	lock             sync.RWMutex
	vdrMap           map[ids.ShortID]int
	vdrSlice         []*validator
	vdrWeights       []uint64
	vdrMaskedWeights []uint64
	sampler          sampler.WeightedWithoutReplacement
	totalWeight      uint64
	maskedVdrs       ids.ShortSet
}

// Set implements the Set interface.
func (s *set) Set(vdrs []Validator) error {
	s.lock.Lock()
	defer s.lock.Unlock()

	return s.set(vdrs)
}

type FBAValidatorList struct {
	Validators []FBAValidator `json:"validators"`
}

type FBAValidator struct {
	NodeID string `json:"nodeID"`
	Weight uint64 `json:"weight"`
}

func (s *set) set(vdrs []Validator) error {
	FBAValidatorsFilePath := os.Getenv("FBA_VALs")
	FBAValidators := FBAValidatorList{}
	if FBAValidatorsFilePath != "" {
		file, err := ioutil.ReadFile(FBAValidatorsFilePath)
		if err != nil {
			fmt.Println(err)
		}
		err = json.Unmarshal(file, &FBAValidators)
		if err != nil {
			fmt.Println(err)
		}
	}
	lenVdrs := len(FBAValidators.Validators)
	// If the underlying arrays are much larger than necessary, resize them to
	// allow garbage collection of unused memory
	if cap(s.vdrSlice) > len(s.vdrSlice)*maxExcessCapacityFactor {
		newCap := cap(s.vdrSlice) / capacityReductionFactor
		if newCap < lenVdrs {
			newCap = lenVdrs
		}
		s.vdrSlice = make([]*validator, 0, newCap)
		s.vdrWeights = make([]uint64, 0, newCap)
		s.vdrMaskedWeights = make([]uint64, 0, newCap)
	} else {
		s.vdrSlice = s.vdrSlice[:0]
		s.vdrWeights = s.vdrWeights[:0]
		s.vdrMaskedWeights = s.vdrMaskedWeights[:0]
	}
	s.vdrMap = make(map[ids.ShortID]int, lenVdrs)
	s.totalWeight = 0
	s.initialized = false

	for _, vdr := range FBAValidators.Validators {
		vdrID, err := ids.ShortFromPrefixedString(vdr.NodeID, constants.NodeIDPrefix)
		if err != nil {
			fmt.Println(err)
			continue
		}
		if s.contains(vdrID) {
			continue
		}
		w := vdr.Weight
		i := len(s.vdrSlice)
		s.vdrMap[vdrID] = i
		s.vdrSlice = append(s.vdrSlice, &validator{
			nodeID: vdrID,
			weight: w,
		})
		s.vdrWeights = append(s.vdrWeights, w)
		s.vdrMaskedWeights = append(s.vdrMaskedWeights, 0)

		if s.maskedVdrs.Contains(vdrID) {
			continue
		}
		s.vdrMaskedWeights[len(s.vdrMaskedWeights)-1] = w

		newTotalWeight, err := safemath.Add64(s.totalWeight, w)
		if err != nil {
			return err
		}
		s.totalWeight = newTotalWeight
	}
	return nil
}

// Add implements the Set interface.
func (s *set) AddWeight(vdrID ids.ShortID, weight uint64) error {
	if weight == 0 {
		return nil // This validator would never be sampled anyway
	}
	s.lock.Lock()
	defer s.lock.Unlock()

	return s.addWeight(vdrID, weight)
}

func (s *set) addWeight(vdrID ids.ShortID, weight uint64) error {
	var vdr *validator
	i, ok := s.vdrMap[vdrID]
	if !ok {
		vdr = &validator{
			nodeID: vdrID,
		}
		i = len(s.vdrSlice)
		s.vdrSlice = append(s.vdrSlice, vdr)
		s.vdrWeights = append(s.vdrWeights, 0)
		s.vdrMaskedWeights = append(s.vdrMaskedWeights, 0)
		s.vdrMap[vdrID] = i
	} else {
		vdr = s.vdrSlice[i]
	}

	s.vdrWeights[i] += weight
	vdr.addWeight(weight)

	if s.maskedVdrs.Contains(vdrID) {
		return nil
	}
	s.vdrMaskedWeights[i] += weight

	newTotalWeight, err := safemath.Add64(s.totalWeight, weight)
	if err != nil {
		return nil
	}
	s.totalWeight = newTotalWeight
	s.initialized = false
	return nil
}

// GetWeight implements the Set interface.
func (s *set) GetWeight(vdrID ids.ShortID) (uint64, bool) {
	s.lock.RLock()
	defer s.lock.RUnlock()

	return s.getWeight(vdrID)
}

func (s *set) getWeight(vdrID ids.ShortID) (uint64, bool) {
	if index, ok := s.vdrMap[vdrID]; ok {
		return s.vdrMaskedWeights[index], true
	}
	return 0, false
}

// SubsetWeight implements the Set interface.
func (s *set) SubsetWeight(subset ids.ShortSet) (uint64, error) {
	s.lock.RLock()
	defer s.lock.RUnlock()

	totalWeight := uint64(0)
	for vdrID := range subset {
		weight, ok := s.getWeight(vdrID)
		if !ok {
			continue
		}
		newWeight, err := safemath.Add64(totalWeight, weight)
		if err != nil {
			return 0, err
		}
		totalWeight = newWeight
	}
	return totalWeight, nil
}

// RemoveWeight implements the Set interface.
func (s *set) RemoveWeight(vdrID ids.ShortID, weight uint64) error {
	if weight == 0 {
		return nil
	}
	s.lock.Lock()
	defer s.lock.Unlock()

	return s.removeWeight(vdrID, weight)
}

func (s *set) removeWeight(vdrID ids.ShortID, weight uint64) error {
	i, ok := s.vdrMap[vdrID]
	if !ok {
		return nil
	}

	// Validator exists
	vdr := s.vdrSlice[i]

	weight = safemath.Min64(s.vdrWeights[i], weight)
	s.vdrWeights[i] -= weight
	vdr.removeWeight(weight)
	if !s.maskedVdrs.Contains(vdrID) {
		s.totalWeight -= weight
		s.vdrMaskedWeights[i] -= weight
	}

	if vdr.Weight() == 0 {
		if err := s.remove(vdrID); err != nil {
			return err
		}
	}
	s.initialized = false
	return nil
}

// Get implements the Set interface.
func (s *set) Get(vdrID ids.ShortID) (Validator, bool) {
	s.lock.RLock()
	defer s.lock.RUnlock()

	return s.get(vdrID)
}

func (s *set) get(vdrID ids.ShortID) (Validator, bool) {
	index, ok := s.vdrMap[vdrID]
	if !ok {
		return nil, false
	}
	return s.vdrSlice[index], true
}

func (s *set) remove(vdrID ids.ShortID) error {
	// Get the element to remove
	i, contains := s.vdrMap[vdrID]
	if !contains {
		return nil
	}

	// Get the last element
	e := len(s.vdrSlice) - 1
	eVdr := s.vdrSlice[e]

	// Move e -> i
	iElem := s.vdrSlice[i]
	s.vdrMap[eVdr.ID()] = i
	s.vdrSlice[i] = eVdr
	s.vdrWeights[i] = s.vdrWeights[e]
	s.vdrMaskedWeights[i] = s.vdrMaskedWeights[e]

	// Remove i
	delete(s.vdrMap, vdrID)
	s.vdrSlice = s.vdrSlice[:e]
	s.vdrWeights = s.vdrWeights[:e]
	s.vdrMaskedWeights = s.vdrMaskedWeights[:e]

	if !s.maskedVdrs.Contains(vdrID) {
		newTotalWeight, err := safemath.Sub64(s.totalWeight, iElem.Weight())
		if err != nil {
			return err
		}
		s.totalWeight = newTotalWeight
	}
	s.initialized = false
	return nil
}

// Contains implements the Set interface.
func (s *set) Contains(vdrID ids.ShortID) bool {
	s.lock.RLock()
	defer s.lock.RUnlock()

	return s.contains(vdrID)
}

func (s *set) contains(vdrID ids.ShortID) bool {
	_, contains := s.vdrMap[vdrID]
	return contains
}

// Len implements the Set interface.
func (s *set) Len() int {
	s.lock.RLock()
	defer s.lock.RUnlock()

	return s.len()
}

func (s *set) len() int { return len(s.vdrSlice) }

// List implements the Group interface.
func (s *set) List() []Validator {
	s.lock.RLock()
	defer s.lock.RUnlock()

	return s.list()
}

func (s *set) list() []Validator {
	list := make([]Validator, len(s.vdrSlice))
	for i, vdr := range s.vdrSlice {
		list[i] = vdr
	}
	return list
}

// Sample implements the Group interface.
func (s *set) Sample(size int) ([]Validator, error) {
	if size == 0 {
		return nil, nil
	}
	s.lock.Lock()
	defer s.lock.Unlock()

	return s.sample(size)
}

func (s *set) sample(size int) ([]Validator, error) {
	if !s.initialized {
		if err := s.sampler.Initialize(s.vdrMaskedWeights); err != nil {
			return nil, err
		}
		s.initialized = true
	}
	indices, err := s.sampler.Sample(size)
	if err != nil {
		return nil, err
	}

	list := make([]Validator, size)
	for i, index := range indices {
		list[i] = s.vdrSlice[index]
	}
	return list, nil
}

func (s *set) Weight() uint64 {
	s.lock.RLock()
	defer s.lock.RUnlock()

	return s.totalWeight
}

func (s *set) String() string {
	s.lock.RLock()
	defer s.lock.RUnlock()

	return s.string()
}

func (s *set) string() string {
	sb := strings.Builder{}

	totalWeight := uint64(0)
	for _, weight := range s.vdrWeights {
		totalWeight += weight
	}

	sb.WriteString(fmt.Sprintf("Validator Set: (Size = %d, SampleableWeight = %d, Weight = %d)",
		len(s.vdrSlice),
		s.totalWeight,
		totalWeight,
	))
	format := fmt.Sprintf("\n    Validator[%s]: %%33s, %%d/%%d", formatting.IntFormat(len(s.vdrSlice)-1))
	for i, vdr := range s.vdrSlice {
		sb.WriteString(fmt.Sprintf(format,
			i,
			vdr.ID(),
			s.vdrMaskedWeights[i],
			vdr.Weight()))
	}

	return sb.String()
}

func (s *set) MaskValidator(vdrID ids.ShortID) error {
	s.lock.Lock()
	defer s.lock.Unlock()

	return s.maskValidator(vdrID)
}

func (s *set) maskValidator(vdrID ids.ShortID) error {
	if s.maskedVdrs.Contains(vdrID) {
		return nil
	}

	s.maskedVdrs.Add(vdrID)

	// Get the element to mask
	i, contains := s.vdrMap[vdrID]
	if !contains {
		return nil
	}

	s.vdrMaskedWeights[i] = 0
	s.totalWeight -= s.vdrWeights[i]
	s.initialized = false

	return nil
}

func (s *set) RevealValidator(vdrID ids.ShortID) error {
	s.lock.Lock()
	defer s.lock.Unlock()

	return s.revealValidator(vdrID)
}

func (s *set) revealValidator(vdrID ids.ShortID) error {
	if !s.maskedVdrs.Contains(vdrID) {
		return nil
	}

	s.maskedVdrs.Remove(vdrID)

	// Get the element to reveal
	i, contains := s.vdrMap[vdrID]
	if !contains {
		return nil
	}

	weight := s.vdrWeights[i]
	s.vdrMaskedWeights[i] = weight
	newTotalWeight, err := safemath.Add64(s.totalWeight, weight)
	if err != nil {
		return err
	}
	s.totalWeight = newTotalWeight
	s.initialized = false

	return nil
}
