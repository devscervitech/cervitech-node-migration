import winston from 'winston';

export class logger {
    private static logger = winston.createLogger({
        level: 'info',
        format: winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
                const colors = {
                    error: '\x1b[31m',   // Red
                    warn: '\x1b[33m',    // Yellow
                    info: '\x1b[36m',    // Cyan
                    debug: '\x1b[35m',   // Magenta
                    reset: '\x1b[0m'
                };

                const color = colors[level as keyof typeof colors] || colors.reset;
                const coloredLevel = `${color}${level.toUpperCase()}${colors.reset}`;

                // key=value formatting for meta
                const metaString = Object.keys(meta).length
                    ? ' | ' + Object.entries(meta)
                        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
                        .join(' ')
                    : '';

                return `[${timestamp}] [${coloredLevel}]: ${message}${metaString}`;
            })
        ),
        transports: [
            new winston.transports.Console(),
        ],
    });

    // Info
    static info(message: string, meta: Record<string, any> = {}): void {
        logger.logger.info(message, meta);
    }

    // Error
    static error(message: string, meta?: unknown): void {
        logger.logger.error(message, meta);
    }

    
    // Warn
    static warn(message: string, meta: Record<string, any> = {}): void {
        logger.logger.warn(message, meta);
    }

    // Debug
    static debug(message: string, meta: Record<string, any> = {}): void {
        logger.logger.debug(message, meta);
    }

    // Stream (for morgan / HTTP logging)
    static stream = {
    write: (message: string) => {
        const trimmed = message.trim();

        const match = trimmed.match(/\s(\d{3})\s/);
        const statusCode = match ? parseInt(match[1], 10) : null;

        if (statusCode) {
            if (statusCode >= 500) {
                logger.logger.error(trimmed);
            } else if (statusCode >= 400) {
                logger.logger.warn(trimmed);
            } else if (statusCode >= 300) {
                logger.logger.warn(trimmed); 
            } else {
                logger.logger.info(trimmed);
            }
        } else {
            logger.logger.info(trimmed);
        }
    }
};
}
