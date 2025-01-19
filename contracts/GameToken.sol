// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract GameToken is ERC20, Ownable, ReentrancyGuard {
    mapping(address => uint256) public pendingRewards;
    uint256 public minWithdrawAmount = 0.01 ether;
    uint256 public totalRewardsDistributed;
    
    event RewardAdded(address indexed player, uint256 amount);
    event RewardWithdrawn(address indexed player, uint256 amount);
    
    constructor() ERC20("CryptoKittyRunner", "CKR") {}
    
    function addReward(address player, uint256 amount) external onlyOwner {
        require(player != address(0), "Invalid player address");
        require(amount > 0, "Amount must be positive");
        
        pendingRewards[player] += amount;
        totalRewardsDistributed += amount;
        
        emit RewardAdded(player, amount);
    }
    
    function withdrawRewards() external nonReentrant {
        uint256 reward = pendingRewards[msg.sender];
        require(reward >= minWithdrawAmount, "Not enough rewards");
        require(address(this).balance >= reward, "Insufficient contract balance");
        
        pendingRewards[msg.sender] = 0;
        
        (bool success, ) = payable(msg.sender).call{value: reward}("");
        require(success, "Transfer failed");
        
        emit RewardWithdrawn(msg.sender, reward);
    }
    
    function setMinWithdrawAmount(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be positive");
        minWithdrawAmount = amount;
    }
    
    function getPendingReward(address player) external view returns (uint256) {
        return pendingRewards[player];
    }
    
    receive() external payable {}
}
