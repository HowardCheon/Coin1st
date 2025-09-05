// StableCoin DApp JavaScript
class StableCoinDApp {
    constructor() {
        this.web3 = null;
        this.contract = null;
        this.account = null;
        this.chainId = null;
        
        // Network configurations
        this.networks = {
            localhost: {
                chainId: '0x7A69', // 31337
                rpcUrl: 'http://127.0.0.1:8546',
                name: 'Hardhat Local',
                nativeCurrency: {
                    name: 'Ether',
                    symbol: 'ETH',
                    decimals: 18
                },
                blockExplorerUrls: null
            },
            sepolia: {
                chainId: '0xAA36A7', // 11155111
                rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/demo',
                name: 'Sepolia Testnet',
                nativeCurrency: {
                    name: 'Ether',
                    symbol: 'ETH',
                    decimals: 18
                },
                blockExplorerUrls: ['https://sepolia.etherscan.io']
            }
        };
        
        // ERC20 Token ABI with admin functions
        this.tokenABI = [
            "function name() view returns (string)",
            "function symbol() view returns (string)",
            "function decimals() view returns (uint8)",
            "function totalSupply() view returns (uint256)",
            "function balanceOf(address) view returns (uint256)",
            "function transfer(address to, uint256 amount) returns (bool)",
            "function owner() view returns (address)",
            "function paused() view returns (bool)",
            "function mint(address to, uint256 amount) returns (bool)",
            "function burn(uint256 amount) returns (bool)",
            "function pause() returns (bool)",
            "function unpause() returns (bool)",
            "function blacklist(address account) returns (bool)",
            "function unBlacklist(address account) returns (bool)",
            "function isBlacklisted(address account) view returns (bool)",
            "function transferOwnership(address newOwner) returns (bool)",
            "event Transfer(address indexed from, address indexed to, uint256 value)",
            "event Paused(address account)",
            "event Unpaused(address account)"
        ];
        
        this.init();
    }
    
    async init() {
        console.log('DApp 초기화 중...');
        
        // Check if MetaMask is installed
        if (typeof window.ethereum !== 'undefined') {
            console.log('MetaMask 감지됨');
            this.web3 = new ethers.providers.Web3Provider(window.ethereum);
            this.setupEventListeners();
            this.updateConnectionStatus();
            
            // Auto-connect if previously connected
            try {
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                if (accounts.length > 0) {
                    console.log('기존 연결된 계정 발견:', accounts[0]);
                    await this.connectWallet();
                }
            } catch (error) {
                console.error('자동 연결 실패:', error);
            }
        } else {
            console.error('MetaMask가 설치되지 않음');
            this.showError('MetaMask가 설치되지 않았습니다. MetaMask를 설치해주세요.');
        }
        
        // Set default contract addresses
        this.setDefaultContractAddresses();
    }
    
    setupEventListeners() {
        // Wallet connection
        document.getElementById('connectWallet').addEventListener('click', () => {
            console.log('연결 버튼 클릭됨');
            this.connectWallet();
        });
        
        // Debug test button
        document.getElementById('testButton').addEventListener('click', () => {
            console.log('디버그 테스트 시작');
            console.log('window.ethereum 존재:', !!window.ethereum);
            console.log('ethers 존재:', !!window.ethers);
            console.log('DApp 인스턴스:', this);
            
            if (window.ethereum) {
                console.log('MetaMask 버전:', window.ethereum.version);
                console.log('isMetaMask:', window.ethereum.isMetaMask);
            }
            
            this.showSuccess('콘솔을 확인해주세요 (F12 → Console)');
        });
        
        // Contract loading
        document.getElementById('loadContract').addEventListener('click', () => this.loadContract());
        
        // Token operations
        document.getElementById('refreshBalance').addEventListener('click', () => this.refreshBalance());
        document.getElementById('transferTokens').addEventListener('click', () => this.transferTokens());
        
        // Admin functions
        document.getElementById('mintTokens').addEventListener('click', () => this.mintTokens());
        document.getElementById('burnTokens').addEventListener('click', () => this.burnTokens());
        document.getElementById('togglePause').addEventListener('click', () => this.togglePause());
        document.getElementById('addBlacklist').addEventListener('click', () => this.addToBlacklist());
        document.getElementById('removeBlacklist').addEventListener('click', () => this.removeFromBlacklist());
        document.getElementById('checkBlacklist').addEventListener('click', () => this.checkBlacklistStatus());
        
        // Network selection
        document.getElementById('networkSelect').addEventListener('change', () => this.onNetworkChange());
        
        // Account and network change listeners
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', (accounts) => {
                if (accounts.length === 0) {
                    this.disconnect();
                } else {
                    this.connectWallet();
                }
            });
            
            window.ethereum.on('chainChanged', (chainId) => {
                window.location.reload();
            });
        }
    }
    
    setDefaultContractAddresses() {
        const networkSelect = document.getElementById('networkSelect');
        const contractAddressInput = document.getElementById('contractAddress');
        
        // Set default contract addresses
        if (networkSelect.value === 'localhost') {
            contractAddressInput.value = '0x8A791620dd6260079BF849Dc5567aDC3F2FdC318';
        } else if (networkSelect.value === 'sepolia') {
            // Deployed HectoCoin contract address
            contractAddressInput.value = '0x88c4b95ad669C02607345C10eef3569894C6D0Be';
        }
    }
    
    async connectWallet() {
        console.log('connectWallet 함수 호출됨');
        try {
            this.showLoading(true);
            
            console.log('MetaMask에 계정 요청 중...');
            const accounts = await window.ethereum.request({ 
                method: 'eth_requestAccounts' 
            });
            
            console.log('받은 계정들:', accounts);
            if (accounts.length === 0) {
                throw new Error('계정을 선택해주세요.');
            }
            
            this.account = accounts[0];
            this.chainId = await window.ethereum.request({ 
                method: 'eth_chainId' 
            });
            
            console.log('연결된 계정:', this.account);
            console.log('체인 ID:', this.chainId);
            
            // UI 업데이트 순서 중요: 먼저 연결 상태를 업데이트하고 지갑 정보를 업데이트
            this.updateConnectionStatus();
            await this.updateWalletInfo();
            
            this.showLoading(false);
            this.showSuccess('MetaMask 연결 성공!');
            
        } catch (error) {
            console.error('지갑 연결 오류:', error);
            this.showLoading(false);
            this.showError('지갑 연결 실패: ' + error.message);
        }
    }
    
    async updateWalletInfo() {
        console.log('updateWalletInfo 호출됨, account:', this.account);
        if (!this.account) {
            console.log('계정이 없어서 리턴');
            return;
        }
        
        try {
            console.log('지갑 주소 업데이트 중...');
            document.getElementById('walletAddress').textContent = 
                this.account.slice(0, 6) + '...' + this.account.slice(-4);
            
            console.log('ETH 잔액 조회 중...');
            // Get ETH balance
            const balance = await this.web3.getBalance(this.account);
            console.log('조회된 잔액:', balance.toString());
            document.getElementById('ethBalance').textContent = 
                parseFloat(ethers.utils.formatEther(balance)).toFixed(4) + ' ETH';
            
            console.log('지갑 정보 섹션 표시 중...');
            document.getElementById('walletInfo').style.display = 'block';
            
            // Update network info
            const networkName = this.getNetworkName();
            console.log('네트워크명:', networkName);
            document.getElementById('currentNetwork').textContent = networkName;
            
            console.log('updateWalletInfo 완료');
        } catch (error) {
            console.error('지갑 정보 업데이트 실패:', error);
        }
    }
    
    updateConnectionStatus() {
        console.log('updateConnectionStatus 호출됨, account:', this.account);
        const statusDiv = document.getElementById('connectionStatus');
        console.log('statusDiv 요소:', !!statusDiv);
        
        if (this.account) {
            console.log('연결됨 상태로 업데이트');
            statusDiv.className = 'status connected';
            statusDiv.textContent = '✅ MetaMask 연결됨';
        } else {
            console.log('연결 안됨 상태로 업데이트');
            statusDiv.className = 'status disconnected';
            statusDiv.textContent = '❌ MetaMask 연결되지 않음';
        }
        console.log('updateConnectionStatus 완료, 클래스:', statusDiv.className, '텍스트:', statusDiv.textContent);
    }
    
    disconnect() {
        this.account = null;
        this.contract = null;
        document.getElementById('walletInfo').style.display = 'none';
        document.getElementById('tokenInfo').style.display = 'none';
        document.getElementById('transferSection').style.display = 'none';
        this.updateConnectionStatus();
    }
    
    async loadContract() {
        console.log('loadContract 함수 호출됨');
        try {
            this.showLoading(true);
            console.log('로딩 표시 시작');
            
            if (!this.account) {
                console.log('계정이 없음');
                throw new Error('먼저 지갑을 연결해주세요.');
            }
            
            const contractAddress = document.getElementById('contractAddress').value;
            console.log('컨트랙트 주소:', contractAddress);
            
            if (!contractAddress || !ethers.utils.isAddress(contractAddress)) {
                console.log('잘못된 컨트랙트 주소');
                throw new Error('올바른 컨트랙트 주소를 입력해주세요.');
            }
            
            console.log('네트워크 확인 및 전환 중...');
            // Check if we need to switch networks
            await this.checkAndSwitchNetwork();
            
            console.log('컨트랙트 인스턴스 생성 중...');
            const signer = this.web3.getSigner();
            this.contract = new ethers.Contract(contractAddress, this.tokenABI, signer);
            
            console.log('토큰 정보 로드 중...');
            await this.loadTokenInfo();
            
            console.log('컨트랙트 로드 완료');
            this.showLoading(false);
            this.showSuccess('토큰 컨트랙트 로드 완료!');
            
        } catch (error) {
            console.error('컨트랙트 로드 오류:', error);
            console.error('오류 상세:', error.message);
            this.showLoading(false);
            this.showError('컨트랙트 로드 실패: ' + error.message);
            
            // 컨트랙트 초기화
            this.contract = null;
        }
    }
    
    async loadTokenInfo() {
        console.log('loadTokenInfo 함수 호출됨');
        if (!this.contract) {
            console.log('컨트랙트가 없어서 리턴');
            return;
        }
        
        try {
            console.log('토큰 기본 정보 조회 중...');
            const [name, symbol, decimals, totalSupply] = await Promise.all([
                this.contract.name(),
                this.contract.symbol(),
                this.contract.decimals(),
                this.contract.totalSupply()
            ]);
            
            console.log('토큰 정보:', { name, symbol, decimals: decimals.toString(), totalSupply: totalSupply.toString() });
            
            document.getElementById('tokenName').textContent = name;
            document.getElementById('tokenSymbol').textContent = symbol;
            document.getElementById('totalSupply').textContent = 
                parseFloat(ethers.utils.formatEther(totalSupply)).toLocaleString() + ' ' + symbol;
            
            console.log('잔액 새로고침 중...');
            await this.refreshBalance();
            
            console.log('관리자 상태 확인 중...');
            // Check admin status
            await this.checkAdminStatus();
            
            console.log('토큰 정보 UI 표시 중...');
            document.getElementById('tokenInfo').style.display = 'block';
            document.getElementById('transferSection').style.display = 'block';
            
            console.log('loadTokenInfo 완료');
            
        } catch (error) {
            console.error('토큰 정보 로드 오류:', error);
            console.error('오류 상세:', error.message);
            throw new Error('토큰 정보를 가져올 수 없습니다: ' + error.message);
        }
    }
    
    async refreshBalance() {
        if (!this.contract || !this.account) return;
        
        try {
            const balance = await this.contract.balanceOf(this.account);
            const symbol = await this.contract.symbol();
            
            document.getElementById('tokenBalance').textContent = 
                parseFloat(ethers.utils.formatEther(balance)).toLocaleString() + ' ' + symbol;
            
        } catch (error) {
            this.showError('잔액 조회 실패: ' + error.message);
        }
    }
    
    async transferTokens() {
        try {
            this.showLoading(true);
            
            if (!this.contract) {
                throw new Error('먼저 토큰 컨트랙트를 로드해주세요.');
            }
            
            const recipient = document.getElementById('recipientAddress').value;
            const amount = document.getElementById('transferAmount').value;
            
            if (!recipient || !ethers.utils.isAddress(recipient)) {
                throw new Error('올바른 받는 주소를 입력해주세요.');
            }
            
            if (!amount || parseFloat(amount) <= 0) {
                throw new Error('올바른 전송 금액을 입력해주세요.');
            }
            
            const amountWei = ethers.utils.parseEther(amount);
            
            // Check balance
            const balance = await this.contract.balanceOf(this.account);
            if (balance.lt(amountWei)) {
                throw new Error('잔액이 부족합니다.');
            }
            
            const tx = await this.contract.transfer(recipient, amountWei);
            
            this.showSuccess('트랜잭션 전송됨! 확인을 기다리는 중...');
            
            const receipt = await tx.wait();
            
            this.showLoading(false);
            this.showSuccess(`토큰 전송 완료! 트랜잭션 해시: ${receipt.transactionHash}`);
            
            // Refresh balance
            await this.refreshBalance();
            await this.updateWalletInfo();
            
            // Clear form
            document.getElementById('recipientAddress').value = '';
            document.getElementById('transferAmount').value = '';
            
        } catch (error) {
            this.showLoading(false);
            this.showError('토큰 전송 실패: ' + error.message);
        }
    }
    
    async checkAndSwitchNetwork() {
        const selectedNetwork = document.getElementById('networkSelect').value;
        const targetNetwork = this.networks[selectedNetwork];
        
        // Update current chain ID
        this.chainId = await window.ethereum.request({ method: 'eth_chainId' });
        console.log('현재 체인 ID:', this.chainId, '목표 체인 ID:', targetNetwork.chainId);
        
        if (this.chainId !== targetNetwork.chainId) {
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: targetNetwork.chainId }],
                });
            } catch (switchError) {
                // Network not added to MetaMask
                if (switchError.code === 4902) {
                    try {
                        console.log('타겟 네트워크:', targetNetwork);
                        
                        const networkParams = {
                            chainId: targetNetwork.chainId,
                            chainName: targetNetwork.name,
                            rpcUrls: [targetNetwork.rpcUrl],
                            nativeCurrency: {
                                name: 'Ether',
                                symbol: 'ETH',
                                decimals: 18
                            }
                        };
                        
                        if (targetNetwork.blockExplorerUrls) {
                            networkParams.blockExplorerUrls = targetNetwork.blockExplorerUrls;
                        }
                        
                        console.log('네트워크 매개변수:', networkParams);
                        
                        await window.ethereum.request({
                            method: 'wallet_addEthereumChain',
                            params: [networkParams],
                        });
                        
                        console.log('네트워크 추가 성공!');
                    } catch (addError) {
                        console.error('네트워크 추가 실패:', addError);
                        throw new Error('네트워크 추가 실패: ' + addError.message);
                    }
                } else {
                    throw new Error('네트워크 전환 실패');
                }
            }
        }
        
        // Update chain ID after network change
        this.chainId = await window.ethereum.request({ method: 'eth_chainId' });
        console.log('최종 체인 ID:', this.chainId);
    }
    
    onNetworkChange() {
        const selectedNetwork = document.getElementById('networkSelect').value;
        const contractAddressInput = document.getElementById('contractAddress');
        
        // Update default contract address based on network
        if (selectedNetwork === 'localhost') {
            contractAddressInput.value = '0x8A791620dd6260079BF849Dc5567aDC3F2FdC318';
        } else if (selectedNetwork === 'sepolia') {
            // Deployed HectoCoin contract address
            contractAddressInput.value = '0x88c4b95ad669C02607345C10eef3569894C6D0Be';
        } else {
            contractAddressInput.value = '';
        }
        
        // Hide token info until new contract is loaded
        document.getElementById('tokenInfo').style.display = 'none';
        document.getElementById('transferSection').style.display = 'none';
        document.getElementById('adminSection').style.display = 'none';
    }
    
    getNetworkName() {
        const networkNames = {
            '0x1': 'Ethereum Mainnet',
            '0x89': 'Polygon',
            '0xAA36A7': 'Sepolia Testnet',
            '0x7A69': 'Hardhat Local'
        };
        
        return networkNames[this.chainId] || `Unknown (${this.chainId})`;
    }
    
    showLoading(show) {
        document.getElementById('loading').style.display = show ? 'block' : 'none';
    }
    
    showSuccess(message) {
        const successDiv = document.getElementById('successMessage');
        successDiv.textContent = message;
        successDiv.style.display = 'block';
        setTimeout(() => {
            successDiv.style.display = 'none';
        }, 5000);
    }
    
    showError(message) {
        const errorDiv = document.getElementById('errorMessage');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }
    
    // Admin Functions
    async checkAdminStatus() {
        console.log('checkAdminStatus 함수 호출됨');
        console.log('contract:', !!this.contract);
        console.log('account:', this.account);
        
        if (!this.contract || !this.account) {
            console.log('컨트랙트 또는 계정이 없음');
            return;
        }
        
        try {
            console.log('소유자 주소 조회 중...');
            const owner = await this.contract.owner();
            console.log('컨트랙트 소유자:', owner);
            console.log('현재 계정:', this.account);
            
            const isAdmin = owner.toLowerCase() === this.account.toLowerCase();
            console.log('관리자 권한:', isAdmin);
            
            const adminStatusDiv = document.getElementById('adminStatus');
            const adminSection = document.getElementById('adminSection');
            
            console.log('관리자 섹션 요소:', !!adminSection);
            
            if (isAdmin) {
                console.log('관리자 계정 - UI 업데이트 중');
                adminStatusDiv.style.background = '#c6f6d5';
                adminStatusDiv.style.color = '#22543d';
                adminStatusDiv.textContent = '✅ 관리자 계정입니다';
                adminSection.style.display = 'block';
                
                // Update pause status
                await this.updatePauseStatus();
                
                console.log('관리자 섹션 표시 완료');
            } else {
                console.log('일반 계정 - 관리자 섹션 숨김');
                adminStatusDiv.style.background = '#fed7d7';
                adminStatusDiv.style.color = '#c53030';
                adminStatusDiv.textContent = '❌ 관리자 계정이 아닙니다';
                adminSection.style.display = 'none';
            }
            
        } catch (error) {
            console.error('관리자 상태 확인 실패:', error);
            console.error('오류 상세:', error.message);
        }
    }
    
    async updatePauseStatus() {
        if (!this.contract) return;
        
        try {
            const isPaused = await this.contract.paused();
            const statusSpan = document.getElementById('pauseStatus');
            const toggleButton = document.getElementById('togglePause');
            
            if (isPaused) {
                statusSpan.textContent = '⏸️ 일시정지됨';
                statusSpan.style.color = '#e53e3e';
                toggleButton.textContent = '▶️ 재개';
            } else {
                statusSpan.textContent = '▶️ 활성';
                statusSpan.style.color = '#38a169';
                toggleButton.textContent = '⏸️ 일시정지';
            }
            
        } catch (error) {
            console.error('일시정지 상태 확인 실패:', error);
        }
    }
    
    async mintTokens() {
        try {
            this.showLoading(true);
            
            if (!this.contract) {
                throw new Error('먼저 토큰 컨트랙트를 로드해주세요.');
            }
            
            const mintAddress = document.getElementById('mintAddress').value;
            const mintAmount = document.getElementById('mintAmount').value;
            
            if (!mintAddress || !ethers.utils.isAddress(mintAddress)) {
                throw new Error('올바른 받는 주소를 입력해주세요.');
            }
            
            if (!mintAmount || parseFloat(mintAmount) <= 0) {
                throw new Error('올바른 발행 수량을 입력해주세요.');
            }
            
            const amountWei = ethers.utils.parseEther(mintAmount);
            const tx = await this.contract.mint(mintAddress, amountWei);
            
            this.showSuccess('토큰 발행 트랜잭션 전송됨! 확인을 기다리는 중...');
            
            const receipt = await tx.wait();
            
            this.showLoading(false);
            this.showSuccess(`토큰 발행 완료! ${mintAmount} HECTO가 ${mintAddress}에 발행되었습니다. 트랜잭션: ${receipt.transactionHash}`);
            
            // Clear form and refresh
            document.getElementById('mintAddress').value = '';
            document.getElementById('mintAmount').value = '';
            await this.refreshBalance();
            await this.loadTokenInfo();
            
        } catch (error) {
            this.showLoading(false);
            this.showError('토큰 발행 실패: ' + error.message);
        }
    }
    
    async burnTokens() {
        try {
            this.showLoading(true);
            
            if (!this.contract) {
                throw new Error('먼저 토큰 컨트랙트를 로드해주세요.');
            }
            
            const burnAmount = document.getElementById('burnAmount').value;
            
            if (!burnAmount || parseFloat(burnAmount) <= 0) {
                throw new Error('올바른 소각 수량을 입력해주세요.');
            }
            
            const amountWei = ethers.utils.parseEther(burnAmount);
            
            // Check balance
            const balance = await this.contract.balanceOf(this.account);
            if (balance.lt(amountWei)) {
                throw new Error('잔액이 부족합니다.');
            }
            
            const tx = await this.contract.burn(amountWei);
            
            this.showSuccess('토큰 소각 트랜잭션 전송됨! 확인을 기다리는 중...');
            
            const receipt = await tx.wait();
            
            this.showLoading(false);
            this.showSuccess(`토큰 소각 완료! ${burnAmount} HECTO가 소각되었습니다. 트랜잭션: ${receipt.transactionHash}`);
            
            // Clear form and refresh
            document.getElementById('burnAmount').value = '';
            await this.refreshBalance();
            await this.loadTokenInfo();
            
        } catch (error) {
            this.showLoading(false);
            this.showError('토큰 소각 실패: ' + error.message);
        }
    }
    
    async togglePause() {
        try {
            this.showLoading(true);
            
            if (!this.contract) {
                throw new Error('먼저 토큰 컨트랙트를 로드해주세요.');
            }
            
            const isPaused = await this.contract.paused();
            const tx = isPaused ? await this.contract.unpause() : await this.contract.pause();
            
            const action = isPaused ? '재개' : '일시정지';
            this.showSuccess(`컨트랙트 ${action} 트랜잭션 전송됨! 확인을 기다리는 중...`);
            
            const receipt = await tx.wait();
            
            this.showLoading(false);
            this.showSuccess(`컨트랙트 ${action} 완료! 트랜잭션: ${receipt.transactionHash}`);
            
            // Update pause status
            await this.updatePauseStatus();
            
        } catch (error) {
            this.showLoading(false);
            this.showError('일시정지 상태 변경 실패: ' + error.message);
        }
    }
    
    async addToBlacklist() {
        try {
            this.showLoading(true);
            
            if (!this.contract) {
                throw new Error('먼저 토큰 컨트랙트를 로드해주세요.');
            }
            
            const address = document.getElementById('blacklistAddress').value;
            
            if (!address || !ethers.utils.isAddress(address)) {
                throw new Error('올바른 계정 주소를 입력해주세요.');
            }
            
            const tx = await this.contract.blacklist(address);
            
            this.showSuccess('블랙리스트 추가 트랜잭션 전송됨! 확인을 기다리는 중...');
            
            const receipt = await tx.wait();
            
            this.showLoading(false);
            this.showSuccess(`${address}가 블랙리스트에 추가되었습니다. 트랜잭션: ${receipt.transactionHash}`);
            
        } catch (error) {
            this.showLoading(false);
            this.showError('블랙리스트 추가 실패: ' + error.message);
        }
    }
    
    async removeFromBlacklist() {
        try {
            this.showLoading(true);
            
            if (!this.contract) {
                throw new Error('먼저 토큰 컨트랙트를 로드해주세요.');
            }
            
            const address = document.getElementById('blacklistAddress').value;
            
            if (!address || !ethers.utils.isAddress(address)) {
                throw new Error('올바른 계정 주소를 입력해주세요.');
            }
            
            const tx = await this.contract.unBlacklist(address);
            
            this.showSuccess('블랙리스트 제거 트랜잭션 전송됨! 확인을 기다리는 중...');
            
            const receipt = await tx.wait();
            
            this.showLoading(false);
            this.showSuccess(`${address}가 블랙리스트에서 제거되었습니다. 트랜잭션: ${receipt.transactionHash}`);
            
        } catch (error) {
            this.showLoading(false);
            this.showError('블랙리스트 제거 실패: ' + error.message);
        }
    }
    
    async checkBlacklistStatus() {
        try {
            if (!this.contract) {
                throw new Error('먼저 토큰 컨트랙트를 로드해주세요.');
            }
            
            const address = document.getElementById('blacklistAddress').value;
            
            if (!address || !ethers.utils.isAddress(address)) {
                throw new Error('올바른 계정 주소를 입력해주세요.');
            }
            
            const isBlacklisted = await this.contract.isBlacklisted(address);
            
            if (isBlacklisted) {
                this.showSuccess(`${address}는 블랙리스트에 포함되어 있습니다.`);
            } else {
                this.showSuccess(`${address}는 블랙리스트에 포함되어 있지 않습니다.`);
            }
            
        } catch (error) {
            this.showError('블랙리스트 상태 확인 실패: ' + error.message);
        }
    }
}

// Initialize DApp when page loads
document.addEventListener('DOMContentLoaded', function() {
    new StableCoinDApp();
});