const { ethers } = require('ethers');
const fs = require('fs');
const readline = require('readline');
const chalk = require('chalk');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function showBanner() {
    console.log(chalk.cyan(`
    ***********************************************
    ************ EVM Bulk Send v1.0.4 *************
    ***********************************************
    Created by github.com/baihaqism
    ***********************************************
    `));
}

async function distributeEth(privateKeys, provider, addresses, amountPerAddress) {
    console.log(chalk.yellow('\n🔹 Starting direct transfer to target addresses...\n'));

    for (let i = 0; i < privateKeys.length; i++) {
        const wallet = new ethers.Wallet(privateKeys[i], provider);
        const senderAddress = wallet.address;

        console.log(chalk.cyan(`🔹 Using wallet ${senderAddress} for transfers.`));

        // Ambil nonce untuk wallet saat ini
        let nonce = await provider.getTransactionCount(senderAddress, "latest");

        // Periksa saldo sebelum mulai transaksi
        let balance = await provider.getBalance(senderAddress);
        console.log(chalk.yellow(`🔹 Initial Balance: ${ethers.formatEther(balance)} ETH\n`));

        for (let j = 0; j < addresses.length; j++) {
            try {
                if (!ethers.isAddress(addresses[j])) {
                    console.log(chalk.red(`❌ Invalid address: ${addresses[j]}. Skipping...`));
                    continue;
                }

                balance = await provider.getBalance(senderAddress); // Update saldo terbaru
                const sendAmount = ethers.parseEther(amountPerAddress.toString());
                const gasPrice = await provider.getFeeData().then(feeData => feeData.gasPrice);
                const estimatedGas = 21000n; // Gas untuk transaksi sederhana
                const totalCost = sendAmount + (estimatedGas * gasPrice);

                if (balance < totalCost) {
                    console.log(chalk.red(`❌ Insufficient balance in ${senderAddress}. Skipping...`));
                    continue;
                }

                const tx = await wallet.sendTransaction({
                    to: addresses[j],
                    value: sendAmount,
                    gasLimit: estimatedGas,
                    gasPrice,
                    nonce
                });

                console.log(chalk.green(`✅ Sent ${amountPerAddress} ETH from ${senderAddress} to ${addresses[j]}`));
                console.log(chalk.gray(`🔗 Transaction hash: ${tx.hash}\n`));

                await tx.wait(); // Tunggu transaksi selesai
                nonce++; // Tingkatkan nonce untuk transaksi berikutnya

            } catch (error) {
                console.log(chalk.red(`❌ Error sending from ${senderAddress} to ${addresses[j]}: ${error.message}\n`));
                continue;
            }
        }
    }

    console.log(chalk.green('\n✅ All direct transfers complete!'));
}

async function main() {
    console.clear();
    showBanner();

    try {
        // Minta inputan RPC URL
        const rpcUrl = await new Promise((resolve) => {
            rl.question(chalk.green('\n🔹 Enter RPC URL: '), resolve);
        });

        const provider = new ethers.JsonRpcProvider(rpcUrl);

        // Baca private keys dari wallet.txt
        const privateKeys = fs.readFileSync('wallet.txt', 'utf8')
            .split('\n')
            .map(key => key.trim())
            .filter(key => key.startsWith("0x") && key.length === 66);

        if (privateKeys.length === 0) {
            throw new Error('❌ No valid private keys found in wallet.txt');
        }

        console.log(chalk.cyan(`\n🔹 Found ${privateKeys.length} private keys`));

        // Periksa saldo setiap wallet
        for (let i = 0; i < privateKeys.length; i++) {
            const wallet = new ethers.Wallet(privateKeys[i], provider);
            const balance = await provider.getBalance(wallet.address);
            console.log(chalk.yellow(`Wallet ${i + 1} address: ${wallet.address}`));
            console.log(chalk.yellow(`Balance: ${ethers.formatEther(balance)} ETH\n`));
        }

        // Minta jumlah ETH yang akan dikirim
        const amountPerAddress = await new Promise((resolve) => {
            rl.question(chalk.green('\n🔹 Enter ETH amount to send to each address: '), resolve);
        });

        // Baca target addresses dari target_addresses.txt
        const addresses = fs.readFileSync('target_addresses.txt', 'utf8')
            .split('\n')
            .map(addr => addr.trim())
            .filter(addr => ethers.isAddress(addr));

        if (addresses.length === 0) {
            throw new Error('❌ No valid addresses found in target_addresses.txt');
        }

        console.log(chalk.cyan(`\n🔹 Found ${addresses.length} valid target addresses`));

        // Distribusikan ETH
        await distributeEth(privateKeys, provider, addresses, parseFloat(amountPerAddress));

    } catch (error) {
        console.log(chalk.red(`\n❌ Error: ${error.message}`));
    } finally {
        rl.close();
    }
}

main();
