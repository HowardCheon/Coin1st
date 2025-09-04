# StableCoin Contract Interaction Guide

이 가이드는 ethers.js를 사용하여 StableCoin 컨트랙트와 상호작용하는 방법을 설명합니다.

## 📁 스크립트 구조

```
scripts/interactions/
├── setup.js              # 기본 설정 및 연결 스크립트
├── token-operations.js   # 토큰 관련 작업 (전송, 발행, 소각 등)
├── multisig-operations.js # 멀티시그 지갑 작업
├── governance-workflow.js # 거버넌스 워크플로우
└── monitoring.js          # 컨트랙트 모니터링 및 분석
```

## 🚀 빠른 시작

### 1. 환경 설정

```bash
# 환경변수 파일 설정
cp .env.example .env
# .env 파일 편집하여 필요한 값 입력

# 로컬 네트워크 사용시 (기본값)
npm run deploy  # 컨트랙트 배포
```

### 2. 기본 스크립트 실행

```bash
# 기본 설정 및 연결 테스트
npm run interact:setup [network]

# 토큰 작업 (전송, 발행, 소각)
npm run interact:token [network]

# 멀티시그 작업
npm run interact:multisig [network]

# 거버넌스 워크플로우
npm run interact:governance [network]

# 모니터링 및 분석
npm run interact:monitor [network]
```

**네트워크 옵션**: `local` (기본값), `sepolia`

## 🔧 스크립트 상세 설명

### 1. Setup Script (`setup.js`)

**목적**: 블록체인 연결 및 컨트랙트 인스턴스 초기화

**주요 기능**:
- 로컬/테스트넷 연결
- 컨트랙트 로드 및 검증
- 네트워크 정보 출력

**사용 예시**:
```javascript
const { ContractSetup } = require('./setup.js');

const setup = new ContractSetup();
await setup.init('local');
await setup.loadContracts({
    stableCoin: '0x5FbDB2315678afecb367f032d93F642f64180aa3'
});
```

### 2. Token Operations (`token-operations.js`)

**목적**: StableCoin 토큰 관련 모든 작업

**주요 기능**:
- ✅ 토큰 전송 (`transfer`, `transferFrom`)
- ✅ 승인 관리 (`approve`, `allowance`)
- ✅ 발행/소각 (`mint`, `burn`, `burnFrom`)
- ✅ 일시정지 (`pause`, `unpause`)
- ✅ 블랙리스트 관리 (`blacklist`, `unBlacklist`)
- ✅ 배치 작업 (`batchTransfer`, `batchBlacklist`)
- ✅ 잔액 조회 및 거래 내역

**사용 예시**:
```javascript
const TokenOperations = require('./token-operations.js');

const tokenOps = new TokenOperations(setup);
tokenOps.setContract('stableCoin');

// 토큰 전송
await tokenOps.transfer('0x...', 100);

// 배치 전송
await tokenOps.batchTransfer(
  ['0x...', '0x...'], 
  [100, 200]
);

// 토큰 발행 (소유자만)
await tokenOps.mint('0x...', 1000);
```

### 3. MultiSig Operations (`multisig-operations.js`)

**목적**: 멀티시그 지갑 관리 및 트랜잭션 처리

**주요 기능**:
- 📝 트랜잭션 제출 (`submitTransaction`)
- ✅ 트랜잭션 승인 (`confirmTransaction`)
- 🚀 트랜잭션 실행 (`executeTransaction`)
- ❌ 승인 철회 (`revokeConfirmation`)
- 📋 트랜잭션 상태 조회
- 📊 배치 작업 (`batchConfirm`)

**사용 예시**:
```javascript
const MultiSigOperations = require('./multisig-operations.js');

const multiSigOps = new MultiSigOperations(setup);
multiSigOps.setContract('multiSig');

// 트랜잭션 제출
const result = await multiSigOps.submitTransaction(
  '0x...', // to
  ethers.parseEther('1'), // value
  '0x' // data
);

// 트랜잭션 승인
await multiSigOps.confirmTransaction(result.txIndex);

// 트랜잭션 실행
await multiSigOps.executeTransaction(result.txIndex);
```

### 4. Governance Workflow (`governance-workflow.js`)

**목적**: 완전한 거버넌스 프로세스 (MultiSig + TimeLock + Token)

**주요 기능**:
- 🗳️ 거버넌스 제안 생성 및 실행
- ⏰ TimeLock 큐잉 및 실행
- 🏛️ 거버넌스 시스템 개요
- 🔐 권한 확인
- 📋 대기 중인 제안 조회

**일반적인 제안들**:
- 토큰 발행 (`proposeMintTokens`)
- 컨트랙트 일시정지 (`proposePauseContract`)
- 주소 블랙리스트 (`proposeBlacklistAddress`)
- 역할 부여/철회 (`proposeGrantRole`, `proposeRevokeRole`)

**사용 예시**:
```javascript
const GovernanceWorkflow = require('./governance-workflow.js');

const governance = new GovernanceWorkflow(setup);
await governance.init();

// 토큰 발행 제안
await governance.proposeMintTokens('0x...', 1000);

// 컨트랙트 일시정지 제안
await governance.proposePauseContract();
```

### 5. Monitoring (`monitoring.js`)

**목적**: 실시간 모니터링 및 분석

**주요 기능**:
- 👂 실시간 이벤트 모니터링
- 📊 거래 패턴 분석
- 📈 멀티시그 활동 분석
- 🖥️ 실시간 대시보드
- 📜 역사적 데이터 분석
- ⛽ 가스 사용량 모니터링

**사용 예시**:
```javascript
const ContractMonitor = require('./monitoring.js');

const monitor = new ContractMonitor(setup);
await monitor.init();

// 실시간 이벤트 모니터링
await monitor.startEventMonitoring('stableCoin', 'Transfer');

// 거래 분석
await monitor.analyzeTokenTransfers('stableCoin', 24); // 24시간

// 대시보드 시작
const stopDashboard = await monitor.startDashboard(30000); // 30초마다 업데이트
```

## 💡 사용 시나리오

### 시나리오 1: 기본 토큰 작업

```javascript
// 1. 설정
const setup = new ContractSetup();
await setup.init('local');
await setup.loadContracts({ stableCoin: '0x...' });

// 2. 토큰 작업
const tokenOps = new TokenOperations(setup);
tokenOps.setContract('stableCoin');

// 3. 토큰 전송
await tokenOps.transfer('0x...', 100);
await tokenOps.checkBalance('0x...');
```

### 시나리오 2: 멀티시그를 통한 거버넌스

```javascript
// 1. 거버넌스 워크플로우 초기화
const governance = new GovernanceWorkflow(setup);
await governance.init();

// 2. 새로운 토큰 발행 제안
const result = await governance.proposeMintTokens('0x...', 10000);

// 3. 제안 상태 확인
await governance.getGovernanceOverview();
```

### 시나리오 3: 실시간 모니터링

```javascript
// 1. 모니터 설정
const monitor = new ContractMonitor(setup);
await monitor.init();

// 2. 이벤트 모니터링 시작
await monitor.startEventMonitoring('stableCoin', 'Transfer');
await monitor.startEventMonitoring('multiSig', 'SubmitTransaction');

// 3. 분석 실행
setInterval(async () => {
  await monitor.analyzeTokenTransfers('stableCoin', 1); // 매 시간 분석
}, 3600000);
```

## 🔐 보안 고려사항

### 1. 개인키 관리
```bash
# .env 파일 사용 (커밋하지 마세요!)
PRIVATE_KEY=your_private_key_here
SEPOLIA_RPC_URL=https://...
```

### 2. 네트워크 확인
```javascript
// 항상 네트워크 확인
const networkInfo = await setup.getNetworkInfo();
console.log('Connected to:', networkInfo.name);
```

### 3. 트랜잭션 검증
```javascript
// 트랜잭션 전 잔액 확인
const balance = await tokenOps.checkBalance();
if (balance < transferAmount) {
  throw new Error('Insufficient balance');
}
```

## 📊 가스 최적화

### 배치 작업 사용
```javascript
// 개별 작업 대신 배치 작업 사용
await tokenOps.batchTransfer(recipients, amounts); // 35% 가스 절약
await tokenOps.batchBlacklist(addresses);          // 32% 가스 절약
```

### 가스 한도 설정
```javascript
// 가스 한도 명시적 설정
await tokenOps.transfer('0x...', 100, { gasLimit: 100000 });
```

## 🐛 문제 해결

### 일반적인 오류

1. **Connection refused**
   ```bash
   # 로컬 노드가 실행 중인지 확인
   npm run node
   ```

2. **Contract not found**
   ```javascript
   // 올바른 컨트랙트 주소 확인
   const addresses = {
     stableCoin: '0x5FbDB2315678afecb367f032d93F642f64180aa3'
   };
   ```

3. **Insufficient permissions**
   ```javascript
   // 권한 확인
   const permissions = await governance.checkGovernancePermissions();
   ```

## 🔄 확장 방법

### 커스텀 스크립트 추가

1. `scripts/interactions/` 폴더에 새 파일 생성
2. `setup.js`에서 `ContractSetup` 클래스 import
3. `package.json`에 스크립트 추가:
   ```json
   {
     "scripts": {
       "interact:custom": "node scripts/interactions/custom-script.js"
     }
   }
   ```

### 새로운 컨트랙트 지원

1. `DEFAULT_ADDRESSES`에 컨트랙트 주소 추가
2. `ContractSetup.loadContracts()`에서 로드 로직 추가
3. 각 operation 클래스에서 새 컨트랙트 메서드 추가

## 📚 추가 리소스

- [Ethers.js 문서](https://docs.ethers.org/)
- [Hardhat 문서](https://hardhat.org/docs)
- [OpenZeppelin 가이드](https://docs.openzeppelin.com/)
- [프로젝트 거버넌스 문서](./GOVERNANCE.md)

---

**참고**: 모든 스크립트는 로컬 네트워크에서 먼저 테스트한 후 테스트넷에서 사용하세요.