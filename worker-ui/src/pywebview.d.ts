declare global {
  const pywebview: {
    api: {
      logd: (...args: any[]) => Promise<void>;
      window_show: () => Promise<void>;
      window_hide: () => Promise<void>;
      generate_new_identity: (pri_key_password: string) => Promise<void>;
    };
    token: string;
    platform: string;
  };

  const app_context: {
    is_desktop_pywebview: boolean;
    is_browser_mock_pywebview: boolean;
  };
}

export {};
