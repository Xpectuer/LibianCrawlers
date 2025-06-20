import { DataClean } from "../util.ts";
import { PlatformEnum } from "./media.ts";

export interface Literature {
  platform: typeof PlatformEnum.文献;
  platform_duplicate_id: string;
  last_crawl_time: Temporal.Instant | null;
  crawl_from_platform: PlatformEnum | null;
  title: string;
  languages: string[];
  create_year: number | null;
  international_standard_serial_number: DataClean.ISSN | null;
  international_standard_book_number: string | null;
  china_standard_serial_number: string | null;
  publication_organizer: string | null;
  publication_place: string | null;
  keywords: string[];
  count_published_documents: number | null;
  count_download_total: number | null;
  count_citations_total: number | null;
  impact_factor_latest: number | null;
  eissn: string | null;
}
