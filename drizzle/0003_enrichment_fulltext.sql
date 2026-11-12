-- Keyword search over fetched pages (SP-14). drizzle-kit can't declare FULLTEXT indexes.
CREATE FULLTEXT INDEX `item_enrichment_fulltext` ON `item_enrichment` (`title`, `summary`, `text_snapshot`);
