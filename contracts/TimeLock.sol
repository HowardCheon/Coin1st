// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract TimeLock is AccessControl, ReentrancyGuard {
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 public constant CANCELLER_ROLE = keccak256("CANCELLER_ROLE");

    uint256 public constant MINIMUM_DELAY = 1 hours;
    uint256 public constant MAXIMUM_DELAY = 30 days;

    uint256 public delay;
    mapping(bytes32 => bool) public queuedTransactions;

    event QueueTransaction(
        bytes32 indexed txHash,
        address indexed target,
        uint256 value,
        string signature,
        bytes data,
        uint256 executeTime
    );

    event ExecuteTransaction(
        bytes32 indexed txHash,
        address indexed target,
        uint256 value,
        string signature,
        bytes data,
        uint256 executeTime
    );

    event CancelTransaction(
        bytes32 indexed txHash,
        address indexed target,
        uint256 value,
        string signature,
        bytes data,
        uint256 executeTime
    );

    event NewDelay(uint256 indexed newDelay);

    constructor(uint256 _delay, address[] memory proposers, address[] memory executors, address admin) {
        require(_delay >= MINIMUM_DELAY, "TimeLock: delay must be greater than minimum delay");
        require(_delay <= MAXIMUM_DELAY, "TimeLock: delay must be less than maximum delay");
        
        delay = _delay;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);

        // Grant proposer role
        for (uint256 i = 0; i < proposers.length; i++) {
            _grantRole(PROPOSER_ROLE, proposers[i]);
        }

        // Grant executor role
        for (uint256 i = 0; i < executors.length; i++) {
            _grantRole(EXECUTOR_ROLE, executors[i]);
        }

        // Grant canceller role to admin
        _grantRole(CANCELLER_ROLE, admin);
    }

    function queueTransaction(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data,
        uint256 executeTime
    ) public onlyRole(PROPOSER_ROLE) returns (bytes32) {
        require(
            executeTime >= block.timestamp + delay,
            "TimeLock: execute time must satisfy delay"
        );

        bytes32 txHash = keccak256(abi.encode(target, value, signature, data, executeTime));
        queuedTransactions[txHash] = true;

        emit QueueTransaction(txHash, target, value, signature, data, executeTime);
        return txHash;
    }

    function cancelTransaction(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data,
        uint256 executeTime
    ) public onlyRole(CANCELLER_ROLE) {
        bytes32 txHash = keccak256(abi.encode(target, value, signature, data, executeTime));
        queuedTransactions[txHash] = false;

        emit CancelTransaction(txHash, target, value, signature, data, executeTime);
    }

    function executeTransaction(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data,
        uint256 executeTime
    ) public payable onlyRole(EXECUTOR_ROLE) nonReentrant returns (bytes memory) {
        bytes32 txHash = keccak256(abi.encode(target, value, signature, data, executeTime));

        require(queuedTransactions[txHash], "TimeLock: transaction hasn't been queued");
        require(block.timestamp >= executeTime, "TimeLock: transaction hasn't surpassed time lock");
        require(block.timestamp <= executeTime + 7 days, "TimeLock: transaction is stale");

        queuedTransactions[txHash] = false;

        bytes memory callData;
        if (bytes(signature).length == 0) {
            callData = data;
        } else {
            callData = abi.encodePacked(bytes4(keccak256(bytes(signature))), data);
        }

        (bool success, bytes memory returnData) = target.call{value: value}(callData);
        require(success, "TimeLock: transaction execution reverted");

        emit ExecuteTransaction(txHash, target, value, signature, data, executeTime);

        return returnData;
    }

    function updateDelay(uint256 newDelay) external {
        require(msg.sender == address(this), "TimeLock: caller must be TimeLock");
        require(newDelay >= MINIMUM_DELAY, "TimeLock: delay must be greater than minimum delay");
        require(newDelay <= MAXIMUM_DELAY, "TimeLock: delay must be less than maximum delay");
        
        delay = newDelay;
        emit NewDelay(newDelay);
    }

    function getBlockTimestamp() public view returns (uint256) {
        return block.timestamp;
    }

    receive() external payable {}
}