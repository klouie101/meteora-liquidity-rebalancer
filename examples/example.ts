import * as dotenv from 'dotenv';
dotenv.config();

import { MeteoraRebalancer } from '../src/index';
import { EdwinSolanaWallet } from 'edwin-sdk';
import { sendAlert, AlertType } from '../src/utils/alerts';

function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cleanupAndExit(code = 0) {
    process.exit(code);
}

async function main() {
    try {
        // Validate required environment variables
        if (!process.env.SOLANA_PRIVATE_KEY) {
            throw new Error('SOLANA_PRIVATE_KEY is not set');
        }
        if (!process.env.METEORA_POOL_ADDRESS) {
            throw new Error('METEORA_POOL_ADDRESS is not set');
        }
        if (!process.env.SOLANA_RPC_URL) {
            throw new Error('SOLANA_RPC_URL is not set');
        }

        // Check if using default RPC URL which is known to be problematic
        const defaultRpcUrl = 'https://api.mainnet-beta.solana.com';
        if (process.env.SOLANA_RPC_URL === defaultRpcUrl) {
            throw new Error('Warning: Using default Solana RPC URL which is known to have issues.\nPlease use a different RPC provider to avoid 410 Gone errors');
        }

        // Set up cleanup on process termination
        process.on('SIGINT', () => cleanupAndExit());
        process.on('SIGTERM', () => cleanupAndExit());

        console.log('Initializing Meteora Rebalancer...');
        await sendAlert(AlertType.INFO, 'Initializing Meteora Rebalancer...');
        const wallet = new EdwinSolanaWallet(process.env.SOLANA_PRIVATE_KEY);
        const meteoraRebalancer = new MeteoraRebalancer(wallet, process.env.METEORA_POOL_ADDRESS);

        console.log('Loading initial state...');
        const changedPosition = await meteoraRebalancer.loadInitialState();
        console.log('Initial position loaded:', changedPosition ? 'Created new position' : 'Using existing position');

        // Define rebalance loop as a separate function
        async function runRebalanceLoop() {
            try {
                console.log('Running rebalance cycle...');
                const changedPosition = await meteoraRebalancer.rebalance();
                if (changedPosition) {
                    console.log('Position was rebalanced');
                }
            } catch (error) {
                // Handle expected errors
                if (error instanceof Error) {
                    if (error.message.includes('Bad request')) {
                        console.error('Expected error running rebalance:', error.message);
                        await sendAlert(AlertType.ERROR, 'Expected error running rebalance: ' + error.message);
                    } else {
                        throw error; // Re-throw unexpected errors
                    }
                } else {
                    throw error;
                }
            }
            await delay(10 * 1000);
            await runRebalanceLoop();
        }

        // Start the rebalance loop after a delay
        console.log('Starting rebalance loop in 10 seconds...');
        setTimeout(runRebalanceLoop, 10 * 1000);
    } catch (error) {
        console.error('Error in main function:', error);
        await cleanupAndExit(1);
    }
}

main().catch(async (error) => {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('Insufficient native token balance for transaction and position creation fees')) {
        console.error(
            'Not enough native token balance for transaction and position creation fees. Please fund the wallet with more native token and try again.'
        );
        await sendAlert(
            AlertType.ERROR,
            'Not enough native token balance for transaction and position creation fees. Please fund the wallet with more native token and try again.'
        );
        await cleanupAndExit(1);
        return;
    }

    console.error('Unexpected error:', error);
    await cleanupAndExit(1);
});
