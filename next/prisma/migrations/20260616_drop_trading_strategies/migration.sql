-- Remove the Freqtrade trading-bot feature: drop the trading_strategies table.
-- The Investments module (IBKR / eToro / Trading 212) is unaffected.
DROP TABLE IF EXISTS "trading_strategies";
