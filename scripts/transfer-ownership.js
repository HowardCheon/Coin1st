const { ethers } = require("hardhat");

async function main() {
    console.log("소유권 이전 시작...");
    
    // 컨트랙트 주소와 새 소유자 주소
    const CONTRACT_ADDRESS = "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318";
    const NEW_OWNER = "0x1e97682dE3f030FD7d012bfA24234955299f4F4C";
    
    const [currentOwner] = await ethers.getSigners();
    console.log("현재 소유자:", currentOwner.address);
    console.log("새 소유자:", NEW_OWNER);
    
    // 컨트랙트 연결
    const StableCoin = await ethers.getContractFactory("StableCoin");
    const contract = await StableCoin.attach(CONTRACT_ADDRESS);
    
    // 현재 소유자 확인
    const currentContractOwner = await contract.owner();
    console.log("컨트랙트 현재 소유자:", currentContractOwner);
    
    if (currentContractOwner.toLowerCase() !== currentOwner.address.toLowerCase()) {
        throw new Error("현재 계정이 컨트랙트 소유자가 아닙니다!");
    }
    
    // 소유권 이전
    console.log("\n소유권 이전 중...");
    const tx = await contract.transferOwnership(NEW_OWNER);
    console.log("트랜잭션 해시:", tx.hash);
    
    await tx.wait();
    console.log("트랜잭션 확인됨!");
    
    // 소유권 이전 확인
    const newContractOwner = await contract.owner();
    console.log("\n✅ 소유권 이전 완료!");
    console.log("새 컨트랙트 소유자:", newContractOwner);
    
    if (newContractOwner.toLowerCase() === NEW_OWNER.toLowerCase()) {
        console.log("🎉 소유권 이전이 성공적으로 완료되었습니다!");
    } else {
        console.log("❌ 소유권 이전에 문제가 발생했습니다.");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("소유권 이전 실패:", error);
        process.exit(1);
    });