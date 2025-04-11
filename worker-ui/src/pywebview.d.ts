declare const pywebview: {
  api: {
    logd: (...args: any[]) => Promise<void>;
    window_show: () => Promise<void>;
    window_hide: () => Promise<void>;
  };
  token: string;
  platform: string;
};

declare const app_context: {
  is_desktop_pywebview: boolean;
  is_browser_mock_pywebview: boolean;
};
