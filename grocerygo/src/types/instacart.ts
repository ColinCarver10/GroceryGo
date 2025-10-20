export interface LineItemMeasurement {
  quantity: number;
  unit: string;
}

export interface LineItem {
  name: string;
  quantity: number;
  unit: string;
  display_text: string;
  product_ids?: number[];
  upcs?: string[];
  line_item_measurements: LineItemMeasurement[];
  filters: {
    brand_filters: string[];
    health_filters: string[];
  };
}

export interface LandingPageConfiguration {
  partner_linkback_url: string;
  enable_pantry_items: boolean;
}

export interface ShoppingListData {
  title: string;
  image_url?: string;
  link_type: string;
  expires_in: number;
  instructions: string[];
  line_items: LineItem[];
  landing_page_configuration: LandingPageConfiguration;
}

export interface InstacartResponse {
  products_link_url: string;
  expires_at?: string;
}

