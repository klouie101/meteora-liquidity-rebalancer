import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';

dotenv.config();

// Check if Telegram credentials are available
const telegramEnabled = !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
let bot: TelegramBot | null = null;
let TELEGRAM_CHAT_ID: string | null = null;

if (telegramEnabled) {
    bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: false });
    TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID!;
} else {
    console.log('Telegram alerts disabled: Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID environment variables');
}

const ALERT_ICONS = {
    ERROR: '🚨',
    LOSS: '📉',
    PERFORMANCE_REPORT: '📊',
    WARNING: '⚠️',
    INFO: 'ℹ️',
} as const;

export enum AlertType {
    LOSS = 'LOSS',
    PERFORMANCE_REPORT = 'PERFORMANCE_REPORT',
    ERROR = 'ERROR',
    WARNING = 'WARNING',
    INFO = 'INFO'
}

export async function sendAlert(type: AlertType, message: string) {
    const prefix = `${ALERT_ICONS[type]}[${type}] `;
    const formattedMessage = prefix + message;
    
    // Always log to console
    console.log(formattedMessage);
    
    // Send to Telegram if enabled
    if (telegramEnabled && bot && TELEGRAM_CHAT_ID) {
        try {
            await bot.sendMessage(TELEGRAM_CHAT_ID, formattedMessage);
        } catch (error) {
            console.error('Failed to send Telegram alert:', error);
        }
    }
}

export function checkLossThreshold(currentValue: number, previousValue?: number, threshold = -0.02): boolean {
    if (!previousValue) {
        return false;
    }
    const percentageChange = (currentValue - previousValue) / previousValue;
    if (percentageChange <= threshold) {
        sendAlert(
            AlertType.LOSS,
            `Value dropped by ${(percentageChange * 100).toFixed(2)}%\n` +
                `Previous: $${previousValue.toFixed(2)}\n` +
                `Current: $${currentValue.toFixed(2)}`
        );
        return true;
    }
    return false;
}

export function sendPerformanceReport(currentValue: number, previousValue: number) {
    const change = currentValue - previousValue;
    const percentChange = (change / previousValue) * 100;

    sendAlert(
        AlertType.PERFORMANCE_REPORT,
        `Performance Report:\n` +
            `Current Value: $${currentValue.toFixed(2)}\n` +
            `Change: ${change >= 0 ? '+' : ''}$${change.toFixed(2)} (${percentChange.toFixed(2)}%)`
    );
}
