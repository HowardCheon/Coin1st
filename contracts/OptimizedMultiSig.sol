// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// Custom errors for gas optimization
error NotOwner();
error TransactionDoesNotExist();
error TransactionAlreadyExecuted();
error TransactionAlreadyConfirmed();
error InsufficientConfirmations();
error TransactionFailed();
error InvalidOwner();
error OwnerAlreadyExists();
error OwnerNotFound();
error InvalidRequirement();

contract OptimizedMultiSig is ReentrancyGuard {
    // Packed events for gas optimization
    event Deposit(address indexed sender, uint256 amount);
    event TransactionSubmitted(address indexed owner, uint256 indexed txIndex);
    event TransactionConfirmed(address indexed owner, uint256 indexed txIndex);
    event TransactionRevoked(address indexed owner, uint256 indexed txIndex);
    event TransactionExecuted(address indexed owner, uint256 indexed txIndex);

    // Packed struct for gas optimization (fits in 2 storage slots)
    struct Transaction {
        address to;           // 20 bytes
        uint96 value;        // 12 bytes (slot 1: 32 bytes total)
        bytes data;          // dynamic (separate storage)
        uint16 confirmations; // 2 bytes
        bool executed;       // 1 byte
        // 13 bytes remaining in slot 2
    }

    // State variables packed for gas optimization
    address[] private _owners;
    mapping(address => bool) private _isOwner;
    uint256 private _required;
    
    Transaction[] private _transactions;
    mapping(uint256 => mapping(address => bool)) private _confirmations;

    modifier onlyOwner() {
        if (!_isOwner[msg.sender]) revert NotOwner();
        _;
    }

    modifier txExists(uint256 txIndex) {
        if (txIndex >= _transactions.length) revert TransactionDoesNotExist();
        _;
    }

    modifier notExecuted(uint256 txIndex) {
        if (_transactions[txIndex].executed) revert TransactionAlreadyExecuted();
        _;
    }

    modifier notConfirmed(uint256 txIndex) {
        if (_confirmations[txIndex][msg.sender]) revert TransactionAlreadyConfirmed();
        _;
    }

    constructor(address[] memory owners, uint256 required) {
        uint256 ownersLength = owners.length;
        if (ownersLength == 0) revert InvalidOwner();
        if (required == 0 || required > ownersLength) revert InvalidRequirement();

        // Gas-optimized owner setup
        for (uint256 i; i < ownersLength;) {
            address owner = owners[i];
            
            if (owner == address(0)) revert InvalidOwner();
            if (_isOwner[owner]) revert OwnerAlreadyExists();

            _isOwner[owner] = true;
            _owners.push(owner);
            
            unchecked { ++i; }
        }

        _required = required;
    }

    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }

    // Gas-optimized transaction submission
    function submitTransaction(address to, uint256 value, bytes calldata data) 
        external 
        onlyOwner 
        returns (uint256 txIndex) 
    {
        txIndex = _transactions.length;
        
        _transactions.push(Transaction({
            to: to,
            value: uint96(value), // Pack value into uint96 (supports up to ~79 billion ETH)
            data: data,
            confirmations: 0,
            executed: false
        }));

        emit TransactionSubmitted(msg.sender, txIndex);
    }

    // Gas-optimized confirmation
    function confirmTransaction(uint256 txIndex)
        external
        onlyOwner
        txExists(txIndex)
        notExecuted(txIndex)
        notConfirmed(txIndex)
    {
        _confirmations[txIndex][msg.sender] = true;
        _transactions[txIndex].confirmations++;
        
        emit TransactionConfirmed(msg.sender, txIndex);
    }

    // Gas-optimized execution with assembly
    function executeTransaction(uint256 txIndex)
        external
        onlyOwner
        txExists(txIndex)
        notExecuted(txIndex)
        nonReentrant
    {
        Transaction storage txn = _transactions[txIndex];
        
        if (txn.confirmations < _required) revert InsufficientConfirmations();
        
        txn.executed = true;
        
        // Use assembly for gas-optimized external call
        bool success;
        assembly {
            let dataPtr := add(txn.slot, 0x60) // data field offset
            let dataSize := mload(dataPtr)
            let dataStart := add(dataPtr, 0x20)
            
            success := call(
                gas(),
                mload(txn.slot),           // to
                mload(add(txn.slot, 0x20)), // value (first 12 bytes of second slot)
                dataStart,
                dataSize,
                0,
                0
            )
        }
        
        if (!success) revert TransactionFailed();
        
        emit TransactionExecuted(msg.sender, txIndex);
    }

    // Gas-optimized revocation
    function revokeConfirmation(uint256 txIndex)
        external
        onlyOwner
        txExists(txIndex)
        notExecuted(txIndex)
    {
        if (!_confirmations[txIndex][msg.sender]) return; // No error, just return
        
        _confirmations[txIndex][msg.sender] = false;
        _transactions[txIndex].confirmations--;
        
        emit TransactionRevoked(msg.sender, txIndex);
    }

    // Batch operations for gas efficiency
    function batchConfirm(uint256[] calldata txIndexes) external onlyOwner {
        uint256 length = txIndexes.length;
        for (uint256 i; i < length;) {
            uint256 txIndex = txIndexes[i];
            
            if (txIndex < _transactions.length && 
                !_transactions[txIndex].executed && 
                !_confirmations[txIndex][msg.sender]) {
                
                _confirmations[txIndex][msg.sender] = true;
                _transactions[txIndex].confirmations++;
                
                emit TransactionConfirmed(msg.sender, txIndex);
            }
            
            unchecked { ++i; }
        }
    }

    function batchRevoke(uint256[] calldata txIndexes) external onlyOwner {
        uint256 length = txIndexes.length;
        for (uint256 i; i < length;) {
            uint256 txIndex = txIndexes[i];
            
            if (txIndex < _transactions.length && 
                !_transactions[txIndex].executed && 
                _confirmations[txIndex][msg.sender]) {
                
                _confirmations[txIndex][msg.sender] = false;
                _transactions[txIndex].confirmations--;
                
                emit TransactionRevoked(msg.sender, txIndex);
            }
            
            unchecked { ++i; }
        }
    }

    // Submit and confirm in one transaction
    function submitAndConfirmTransaction(address to, uint256 value, bytes calldata data)
        external
        onlyOwner
        returns (uint256 txIndex)
    {
        txIndex = _transactions.length;
        
        _transactions.push(Transaction({
            to: to,
            value: uint96(value),
            data: data,
            confirmations: 1, // Start with 1 confirmation
            executed: false
        }));

        _confirmations[txIndex][msg.sender] = true;
        
        emit TransactionSubmitted(msg.sender, txIndex);
        emit TransactionConfirmed(msg.sender, txIndex);
    }

    // Gas-optimized view functions
    function getOwners() external view returns (address[] memory) {
        return _owners;
    }

    function getTransactionCount() external view returns (uint256) {
        return _transactions.length;
    }

    function getTransaction(uint256 txIndex)
        external
        view
        returns (
            address to,
            uint256 value,
            bytes memory data,
            bool executed,
            uint256 confirmations
        )
    {
        Transaction storage txn = _transactions[txIndex];
        return (txn.to, txn.value, txn.data, txn.executed, txn.confirmations);
    }

    function isConfirmed(uint256 txIndex, address owner) external view returns (bool) {
        return _confirmations[txIndex][owner];
    }

    function getConfirmationCount(uint256 txIndex) external view returns (uint256) {
        return _transactions[txIndex].confirmations;
    }

    function getTransactionStatus(uint256 txIndex) 
        external 
        view 
        returns (bool executed, uint256 confirmations, bool canExecute) 
    {
        if (txIndex >= _transactions.length) {
            return (false, 0, false);
        }
        
        Transaction storage txn = _transactions[txIndex];
        return (
            txn.executed,
            txn.confirmations,
            !txn.executed && txn.confirmations >= _required
        );
    }

    // Batch view functions for gas efficiency
    function batchGetTransactionStatus(uint256[] calldata txIndexes)
        external
        view
        returns (
            bool[] memory executed,
            uint256[] memory confirmations,
            bool[] memory canExecute
        )
    {
        uint256 length = txIndexes.length;
        executed = new bool[](length);
        confirmations = new uint256[](length);
        canExecute = new bool[](length);
        
        for (uint256 i; i < length;) {
            uint256 txIndex = txIndexes[i];
            
            if (txIndex < _transactions.length) {
                Transaction storage txn = _transactions[txIndex];
                executed[i] = txn.executed;
                confirmations[i] = txn.confirmations;
                canExecute[i] = !txn.executed && txn.confirmations >= _required;
            }
            
            unchecked { ++i; }
        }
    }

    // Owner management (only callable by wallet itself)
    function addOwner(address owner) external {
        if (msg.sender != address(this)) revert NotOwner();
        if (owner == address(0)) revert InvalidOwner();
        if (_isOwner[owner]) revert OwnerAlreadyExists();

        _isOwner[owner] = true;
        _owners.push(owner);
    }

    function removeOwner(address owner) external {
        if (msg.sender != address(this)) revert NotOwner();
        if (!_isOwner[owner]) revert OwnerNotFound();
        if (_owners.length <= _required) revert InvalidRequirement();

        _isOwner[owner] = false;
        
        // Gas-optimized removal
        uint256 length = _owners.length;
        for (uint256 i; i < length;) {
            if (_owners[i] == owner) {
                _owners[i] = _owners[length - 1];
                _owners.pop();
                break;
            }
            unchecked { ++i; }
        }
    }

    function changeRequirement(uint256 required) external {
        if (msg.sender != address(this)) revert NotOwner();
        if (required == 0 || required > _owners.length) revert InvalidRequirement();
        
        _required = required;
    }

    // Additional view functions
    function required() external view returns (uint256) {
        return _required;
    }

    function isOwner(address owner) external view returns (bool) {
        return _isOwner[owner];
    }
}