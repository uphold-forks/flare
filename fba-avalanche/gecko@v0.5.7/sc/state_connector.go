package sc

import (
	"github.com/ava-labs/go-ethereum/common"
)

var (
	LocalNodeAddr = common.HexToAddress("0xc2f30826ADff11307faEA5D349D2bf298098512b")
	Validators = []string {
		"7Xhw2mDxuDS44j42TCB6U5579esbSt3Lg",
		"MFrZFVCXPv5iCn6M9K6XduxGTYp891xXZ",
		"NFBbbJ4qCmNaCzeW7sxErhvWqvEQMnYcN",
		"GWPcbFJZFfZreETSoWjPimr846mXEKCtu",
		"P7oB2McjBGgW2NXXWVYjV8JEDFoW9xDE5",
	}
	UNL = []uint {
		1,
		1000000000000000,
		1000000000000000,
		1000000000000000,
		1,
	}		
	StateConnectorContract = common.HexToAddress("0x9679c89c54245c100fe5196c07ebef5176d74735")
)