// Blockchain Simulator - Fully Functional Implementation
class BlockchainSimulator {
    constructor() {
        this.blockchain = [];
        this.transactionPool = [];
        this.wallets = new Map();
        this.difficulty = 3;
        this.miningReward = 10;
        this.isMining = false;
        this.currentNonce = 0;
        this.hashRate = 0;
        this.blocksMined = 0;
        this.miningStartTime = 0;
        
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    async init() {
        console.log('Initializing blockchain simulator...');
        await this.initializeWallets();
        await this.createGenesisBlock();
        this.setupEventListeners();
        this.renderUI();
        this.startSimulation();
        console.log('Blockchain simulator initialized successfully');
    }

    // Blockchain Core Implementation
    async createGenesisBlock() {
        const genesisBlock = new Block(
            0,
            Date.now(),
            "Genesis Block - The beginning of our blockchain",
            "0",
            []
        );
        genesisBlock.hash = await this.calculateHash(genesisBlock);
        this.blockchain.push(genesisBlock);
        console.log('Genesis block created');
    }

    async calculateHash(block) {
        const data = `${block.index}${block.timestamp}${JSON.stringify(block.transactions)}${block.previousHash}${block.nonce}`;
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async mineBlock(block) {
        const target = "0".repeat(this.difficulty);
        this.currentNonce = 0;
        this.miningStartTime = Date.now();

        while (this.isMining) {
            block.nonce = this.currentNonce;
            const hash = await this.calculateHash(block);
            
            // Update hash rate every 100 attempts
            if (this.currentNonce % 100 === 0) {
                const elapsed = (Date.now() - this.miningStartTime) / 1000;
                this.hashRate = elapsed > 0 ? Math.floor(this.currentNonce / elapsed) : 0;
                this.updateMiningUI();
                
                // Allow UI to update
                await new Promise(resolve => setTimeout(resolve, 1));
            }

            if (hash.startsWith(target)) {
                block.hash = hash;
                return block;
            }

            this.currentNonce++;
        }
        
        return null;
    }

    async addBlock() {
        if (this.blockchain.length === 0) {
            await this.createGenesisBlock();
            return;
        }

        const previousBlock = this.blockchain[this.blockchain.length - 1];
        const transactions = this.transactionPool.splice(0, 10); // Take up to 10 transactions

        // Add mining reward transaction
        const minerAddress = Array.from(this.wallets.keys())[0]; // First wallet gets mining reward
        const rewardTransaction = new Transaction("System", minerAddress, this.miningReward);
        transactions.unshift(rewardTransaction);

        const newBlock = new Block(
            previousBlock.index + 1,
            Date.now(),
            `Block ${previousBlock.index + 1}`,
            previousBlock.hash,
            transactions
        );

        const minedBlock = await this.mineBlock(newBlock);
        
        if (minedBlock && this.isMining) {
            this.blockchain.push(minedBlock);
            this.blocksMined++;
            
            // Process transactions
            this.processTransactions(transactions);
            
            this.renderUI();
            return minedBlock;
        }
        
        return null;
    }

    processTransactions(transactions) {
        transactions.forEach(tx => {
            if (tx.from === "System") {
                // Mining reward
                const wallet = this.wallets.get(tx.to);
                if (wallet) {
                    wallet.balance += tx.amount;
                }
            } else {
                // Regular transaction
                const fromWallet = this.wallets.get(tx.from);
                const toWallet = this.wallets.get(tx.to);
                
                if (fromWallet && toWallet && fromWallet.balance >= tx.amount) {
                    fromWallet.balance -= tx.amount;
                    toWallet.balance += tx.amount;
                }
            }
        });
    }

    validateChain() {
        for (let i = 1; i < this.blockchain.length; i++) {
            const currentBlock = this.blockchain[i];
            const previousBlock = this.blockchain[i - 1];

            // Check if current block hash is valid
            if (!currentBlock.hash.startsWith("0".repeat(this.difficulty))) {
                return false;
            }

            // Check if current block points to previous block
            if (currentBlock.previousHash !== previousBlock.hash) {
                return false;
            }
        }
        return true;
    }

    // Wallet Management
    async initializeWallets() {
        const initialWallets = [
            { label: "Alice", balance: 100 },
            { label: "Bob", balance: 75 },
            { label: "Charlie", balance: 50 }
        ];

        for (const walletData of initialWallets) {
            await this.createWallet(walletData.label, walletData.balance);
        }
        console.log('Initial wallets created');
    }

    async createWallet(label = null, initialBalance = 0) {
        const address = await this.generateAddress();
        const wallet = new Wallet(
            address,
            label || `Wallet ${this.wallets.size + 1}`,
            initialBalance
        );
        
        this.wallets.set(address, wallet);
        this.renderWallets();
        this.updateTransactionSelects();
        return wallet;
    }

    async generateAddress() {
        const randomData = crypto.getRandomValues(new Uint8Array(20));
        const hashBuffer = await crypto.subtle.digest('SHA-256', randomData);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return 'bc1q' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 39);
    }

    // Transaction Management
    addTransaction(from, to, amount) {
        const fromWallet = this.wallets.get(from);
        const toWallet = this.wallets.get(to);

        if (!fromWallet || !toWallet) {
            throw new Error('Invalid wallet address');
        }

        if (fromWallet.balance < amount) {
            throw new Error('Insufficient balance');
        }

        if (amount <= 0) {
            throw new Error('Amount must be positive');
        }

        const transaction = new Transaction(from, to, amount);
        this.transactionPool.push(transaction);
        
        this.renderTransactionPool();
        this.updateUI();
        return transaction;
    }

    // Mining Control
    async startMining() {
        if (this.isMining) return;
        
        this.isMining = true;
        this.updateMiningUI();
        console.log('Mining started');
        
        while (this.isMining) {
            if (this.transactionPool.length > 0 || this.blockchain.length === 1) {
                const block = await this.addBlock();
                if (block) {
                    console.log(`Block ${block.index} mined with hash: ${block.hash}`);
                }
            }
            
            // Small delay to prevent UI blocking
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    stopMining() {
        this.isMining = false;
        this.updateMiningUI();
        console.log('Mining stopped');
    }

    // UI Event Handlers
    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // Tab navigation - FIXED VERSION
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const tabId = btn.getAttribute('data-tab');
                console.log('Tab clicked:', tabId);
                this.switchTab(tabId);
            });
        });

        // Create wallet button
        const createWalletBtn = document.getElementById('createWalletBtn');
        if (createWalletBtn) {
            createWalletBtn.addEventListener('click', async () => {
                const label = prompt('Enter wallet name:');
                if (label) {
                    await this.createWallet(label.trim());
                }
            });
        }

        // Transaction form
        const transactionForm = document.getElementById('transactionForm');
        if (transactionForm) {
            transactionForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSendTransaction();
            });
        }

        // Mining controls
        const startMiningBtn = document.getElementById('startMiningBtn');
        if (startMiningBtn) {
            startMiningBtn.addEventListener('click', () => {
                this.startMining();
            });
        }

        const stopMiningBtn = document.getElementById('stopMiningBtn');
        if (stopMiningBtn) {
            stopMiningBtn.addEventListener('click', () => {
                this.stopMining();
            });
        }

        // Difficulty slider
        const difficultySlider = document.getElementById('difficultySlider');
        if (difficultySlider) {
            difficultySlider.addEventListener('input', (e) => {
                this.difficulty = parseInt(e.target.value);
                document.getElementById('difficultyValue').textContent = this.difficulty;
                document.getElementById('currentDifficulty').textContent = this.difficulty;
                document.getElementById('miningDifficulty').textContent = this.difficulty;
            });
        }

        // Chain validation
        const validateChainBtn = document.getElementById('validateChainBtn');
        if (validateChainBtn) {
            validateChainBtn.addEventListener('click', () => {
                const isValid = this.validateChain();
                const element = document.getElementById('chainIntegrity');
                element.className = `status ${isValid ? 'status--success' : 'status--error'}`;
                element.textContent = isValid ? 'Valid' : 'Invalid';
            });
        }

        // Refresh explorer
        const refreshExplorerBtn = document.getElementById('refreshExplorerBtn');
        if (refreshExplorerBtn) {
            refreshExplorerBtn.addEventListener('click', () => {
                this.renderBlockchainExplorer();
            });
        }

        // Modal close
        const closeBlockModal = document.getElementById('closeBlockModal');
        if (closeBlockModal) {
            closeBlockModal.addEventListener('click', () => {
                this.closeModal('blockModal');
            });
        }

        const modalBackdrop = document.querySelector('.modal-backdrop');
        if (modalBackdrop) {
            modalBackdrop.addEventListener('click', () => {
                this.closeModal('blockModal');
            });
        }
        
        console.log('Event listeners set up successfully');
    }

    handleSendTransaction() {
        const fromAddress = document.getElementById('fromWallet').value;
        const toAddress = document.getElementById('toWallet').value;
        const amount = parseFloat(document.getElementById('amount').value);

        try {
            this.addTransaction(fromAddress, toAddress, amount);
            document.getElementById('transactionForm').reset();
            alert('Transaction added to pool successfully!');
        } catch (error) {
            alert(`Transaction failed: ${error.message}`);
        }
    }

    // UI Rendering
    switchTab(tabId) {
        console.log('Switching to tab:', tabId);
        
        if (!tabId) {
            console.error('No tab ID provided');
            return;
        }
        
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            const btnTabId = btn.getAttribute('data-tab');
            if (btnTabId === tabId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        const targetTab = document.getElementById(tabId);
        if (targetTab) {
            targetTab.classList.add('active');
            console.log('Successfully switched to tab:', tabId);
        } else {
            console.error('Target tab not found:', tabId);
        }

        // Refresh content for specific tabs
        if (tabId === 'explorer') {
            this.renderBlockchainExplorer();
        } else if (tabId === 'wallets') {
            this.renderWallets();
        } else if (tabId === 'transactions') {
            this.renderTransactionPool();
        }
    }

    renderWallets() {
        const walletsGrid = document.getElementById('walletsGrid');
        if (!walletsGrid) return;
        
        walletsGrid.innerHTML = '';

        this.wallets.forEach(wallet => {
            const walletCard = document.createElement('div');
            walletCard.className = 'wallet-card fade-in';
            walletCard.innerHTML = `
                <div class="wallet-header">
                    <h4 class="wallet-label">${wallet.label}</h4>
                </div>
                <div class="wallet-address">${wallet.address}</div>
                <div class="wallet-balance">${wallet.balance.toFixed(2)} BTC</div>
                <div class="wallet-actions">
                    <button class="btn btn--sm btn--primary" onclick="simulator.selectWalletForTransaction('${wallet.address}')">
                        Use for Transaction
                    </button>
                </div>
            `;
            walletsGrid.appendChild(walletCard);
        });
    }

    selectWalletForTransaction(address) {
        this.switchTab('transactions');
        const fromWallet = document.getElementById('fromWallet');
        if (fromWallet) {
            fromWallet.value = address;
        }
    }

    updateTransactionSelects() {
        const fromSelect = document.getElementById('fromWallet');
        const toSelect = document.getElementById('toWallet');
        
        if (!fromSelect || !toSelect) return;
        
        [fromSelect, toSelect].forEach(select => {
            const currentValue = select.value;
            select.innerHTML = '<option value="">Select wallet...</option>';
            
            this.wallets.forEach(wallet => {
                const option = document.createElement('option');
                option.value = wallet.address;
                option.textContent = `${wallet.label} (${wallet.balance.toFixed(2)} BTC)`;
                select.appendChild(option);
            });
            
            if (currentValue) {
                select.value = currentValue;
            }
        });
    }

    renderTransactionPool() {
        const transactionPool = document.getElementById('transactionPool');
        if (!transactionPool) return;
        
        if (this.transactionPool.length === 0) {
            transactionPool.innerHTML = '<p class="empty-state">No pending transactions</p>';
            return;
        }

        transactionPool.innerHTML = '';
        
        this.transactionPool.forEach(tx => {
            const txElement = document.createElement('div');
            txElement.className = 'transaction-item fade-in';
            
            const fromLabel = this.wallets.get(tx.from)?.label || 'Unknown';
            const toLabel = this.wallets.get(tx.to)?.label || 'Unknown';
            
            txElement.innerHTML = `
                <div class="transaction-info">
                    <div class="transaction-details">
                        <strong>${fromLabel}</strong> → <strong>${toLabel}</strong>
                        <span style="margin-left: 12px;">${tx.amount.toFixed(2)} BTC</span>
                    </div>
                    <div class="transaction-hash">ID: ${tx.id}</div>
                </div>
                <div class="transaction-status">
                    <span class="status status--warning">Pending</span>
                </div>
            `;
            
            transactionPool.appendChild(txElement);
        });
    }

    renderBlockchainExplorer() {
        const explorer = document.getElementById('blockchainExplorer');
        if (!explorer) return;
        
        explorer.innerHTML = '';

        if (this.blockchain.length === 0) {
            explorer.innerHTML = '<p class="empty-state">No blocks in chain</p>';
            return;
        }

        // Reverse to show newest blocks first
        const reversedBlocks = [...this.blockchain].reverse();
        
        reversedBlocks.forEach(block => {
            const blockElement = document.createElement('div');
            blockElement.className = 'block-item fade-in';
            blockElement.addEventListener('click', () => this.showBlockDetails(block));
            
            blockElement.innerHTML = `
                <div class="block-header">
                    <span class="block-number">Block #${block.index}</span>
                    <span class="block-timestamp">${new Date(block.timestamp).toLocaleString()}</span>
                </div>
                <div class="block-hash">${block.hash || 'Generating...'}</div>
                <div class="block-details">
                    <div class="block-detail">
                        <span>Transactions:</span>
                        <span>${block.transactions.length}</span>
                    </div>
                    <div class="block-detail">
                        <span>Nonce:</span>
                        <span>${block.nonce}</span>
                    </div>
                    <div class="block-detail">
                        <span>Previous Hash:</span>
                        <span>${block.previousHash.substring(0, 20)}...</span>
                    </div>
                </div>
            `;
            
            explorer.appendChild(blockElement);
        });
    }

    showBlockDetails(block) {
        const modal = document.getElementById('blockModal');
        const details = document.getElementById('blockDetails');
        
        if (!modal || !details) return;
        
        let transactionsHtml = '';
        if (block.transactions.length > 0) {
            transactionsHtml = `
                <div class="transaction-list">
                    <h4>Transactions (${block.transactions.length})</h4>
                    ${block.transactions.map(tx => {
                        const fromLabel = tx.from === "System" ? "Mining Reward" : (this.wallets.get(tx.from)?.label || 'Unknown');
                        const toLabel = this.wallets.get(tx.to)?.label || 'Unknown';
                        return `
                            <div class="transaction-in-block">
                                <strong>${fromLabel}</strong> → <strong>${toLabel}</strong>: ${tx.amount.toFixed(2)} BTC
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }
        
        details.innerHTML = `
            <div class="block-detail-item">
                <span class="block-detail-label">Block Number:</span>
                <span class="block-detail-value">${block.index}</span>
            </div>
            <div class="block-detail-item">
                <span class="block-detail-label">Timestamp:</span>
                <span class="block-detail-value">${new Date(block.timestamp).toLocaleString()}</span>
            </div>
            <div class="block-detail-item">
                <span class="block-detail-label">Hash:</span>
                <span class="block-detail-value">${block.hash || 'Mining...'}</span>
            </div>
            <div class="block-detail-item">
                <span class="block-detail-label">Previous Hash:</span>
                <span class="block-detail-value">${block.previousHash}</span>
            </div>
            <div class="block-detail-item">
                <span class="block-detail-label">Nonce:</span>
                <span class="block-detail-value">${block.nonce}</span>
            </div>
            <div class="block-detail-item">
                <span class="block-detail-label">Data:</span>
                <span class="block-detail-value">${block.data}</span>
            </div>
            ${transactionsHtml}
        `;
        
        modal.classList.remove('hidden');
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    updateMiningUI() {
        const elements = {
            miningStatus: this.isMining ? 'Mining...' : 'Stopped',
            currentNonce: this.isMining ? this.currentNonce.toLocaleString() : '-',
            hashRate: this.hashRate.toLocaleString() + ' H/s',
            blocksMined: this.blocksMined
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });

        // Update progress bar (simulate progress based on nonce)
        const progressBar = document.getElementById('miningProgressBar');
        const progressText = document.getElementById('miningProgressText');
        
        if (progressBar && progressText) {
            if (this.isMining) {
                const progress = Math.min((this.currentNonce % 10000) / 100, 100);
                progressBar.style.width = progress + '%';
                progressText.textContent = `Mining block ${this.blockchain.length}... (${progress.toFixed(1)}%)`;
            } else {
                progressBar.style.width = '0%';
                progressText.textContent = 'Ready to mine';
            }
        }

        // Update button states
        const startBtn = document.getElementById('startMiningBtn');
        const stopBtn = document.getElementById('stopMiningBtn');
        if (startBtn) startBtn.disabled = this.isMining;
        if (stopBtn) stopBtn.disabled = !this.isMining;
    }

    updateUI() {
        // Update dashboard metrics
        const elements = {
            blockCount: this.blockchain.length,
            totalBlocks: this.blockchain.length,
            totalTransactions: this.blockchain.reduce((acc, block) => acc + block.transactions.length, 0),
            miningDifficulty: this.difficulty,
            pendingTransactions: this.transactionPool.length,
            confirmedTransactions: this.blockchain.reduce((acc, block) => acc + block.transactions.length, 0),
            miningReward: this.miningReward,
            currentDifficulty: this.difficulty
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });

        // Re-render dynamic content
        this.renderWallets();
        this.updateTransactionSelects();
    }

    renderUI() {
        this.updateUI();
        this.renderTransactionPool();
        this.renderBlockchainExplorer();
    }

    startSimulation() {
        console.log('Starting simulation...');
        
        // Add some random transactions periodically
        setInterval(() => {
            if (Math.random() < 0.2 && this.wallets.size >= 2) {
                const addresses = Array.from(this.wallets.keys());
                const from = addresses[Math.floor(Math.random() * addresses.length)];
                let to = addresses[Math.floor(Math.random() * addresses.length)];
                
                while (to === from) {
                    to = addresses[Math.floor(Math.random() * addresses.length)];
                }
                
                const fromWallet = this.wallets.get(from);
                const maxAmount = fromWallet.balance * 0.1; // Max 10% of balance
                
                if (maxAmount > 1) {
                    const amount = Math.random() * maxAmount + 0.5;
                    try {
                        this.addTransaction(from, to, amount);
                        console.log('Auto-generated transaction:', fromWallet.label, '->', this.wallets.get(to).label, amount.toFixed(2), 'BTC');
                    } catch (e) {
                        // Ignore failed transactions
                    }
                }
            }
        }, 8000);

        // Update UI periodically
        setInterval(() => {
            if (this.isMining) {
                this.updateMiningUI();
            }
        }, 500);
    }
}

// Block class definition
class Block {
    constructor(index, timestamp, data, previousHash, transactions = []) {
        this.index = index;
        this.timestamp = timestamp;
        this.data = data;
        this.previousHash = previousHash;
        this.transactions = transactions;
        this.nonce = 0;
        this.hash = null;
    }
}

// Transaction class definition
class Transaction {
    constructor(from, to, amount) {
        this.id = this.generateId();
        this.from = from;
        this.to = to;
        this.amount = amount;
        this.timestamp = Date.now();
    }

    generateId() {
        return 'tx_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    }
}

// Wallet class definition
class Wallet {
    constructor(address, label, balance = 0) {
        this.address = address;
        this.label = label;
        this.balance = balance;
        this.createdAt = Date.now();
    }
}

// Initialize the simulator
let simulator;

// Create global instance
simulator = new BlockchainSimulator();