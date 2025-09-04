const fs = require('fs');
const path = require('path');

// Read the contract file
const contractPath = path.join(__dirname, 'contracts', 'StableCoin.sol');
const contractContent = fs.readFileSync(contractPath, 'utf8');

console.log("📄 StableCoin 컨트랙트 분석");
console.log("=" * 50);

// Extract key information
const nameMatch = contractContent.match(/contract\s+(\w+)/);
const contractName = nameMatch ? nameMatch[1] : 'Unknown';

console.log(`컨트랙트 이름: ${contractName}`);

// Check for imports
const imports = contractContent.match(/@openzeppelin[^;]+/g) || [];
console.log(`\n사용된 OpenZeppelin 라이브러리:`);
imports.forEach(imp => console.log(`  - ${imp}`));

// Check for main functions
const functions = contractContent.match(/function\s+(\w+)/g) || [];
console.log(`\n주요 함수들:`);
functions.forEach(func => console.log(`  - ${func}`));

// Check for events
const events = contractContent.match(/event\s+(\w+)/g) || [];
console.log(`\n이벤트들:`);
events.forEach(event => console.log(`  - ${event}`));

// Check for modifiers
const modifiers = contractContent.match(/modifier\s+(\w+)/g) || [];
console.log(`\n수정자들:`);
modifiers.forEach(modifier => console.log(`  - ${modifier}`));

console.log(`\n컨트랙트 특징:`);
console.log(`  - ERC20 표준 토큰`);
console.log(`  - Owner 권한 관리`);
console.log(`  - Pausable (일시정지 기능)`);
console.log(`  - Blacklist (블랙리스트 기능)`);
console.log(`  - Mint/Burn 기능`);