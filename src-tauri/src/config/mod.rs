//! 配置管理模块
//!
//! 负责应用配置的加载、保存和验证

mod settings;

// Re-export all config types for external use
#[allow(unused_imports)]
pub use settings::{AppConfig, PrinterConfig, ServerConfig, UiConfig};

use std::path::PathBuf;
use tracing::{debug, info, warn};

/// 获取配置文件路径
pub fn get_config_path() -> PathBuf {
    // Windows: %APPDATA%/rprint/config.json
    // Linux/Mac: ~/.config/rprint/config.json
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("rprint");

    // 确保目录存在
    if !config_dir.exists() {
        if let Err(e) = std::fs::create_dir_all(&config_dir) {
            warn!("Failed to create config directory: {}", e);
        }
    }

    config_dir.join("config.json")
}

/// 加载配置
pub fn load_config() -> AppConfig {
    let path = get_config_path();
    debug!("Loading config from: {:?}", path);

    if path.exists() {
        match std::fs::read_to_string(&path) {
            Ok(content) => match serde_json::from_str(&content) {
                Ok(config) => {
                    info!("Config loaded successfully");
                    return config;
                }
                Err(e) => {
                    warn!("Failed to parse config file: {}", e);
                }
            },
            Err(e) => {
                warn!("Failed to read config file: {}", e);
            }
        }
    }

    // 返回默认配置
    info!("Using default config");
    AppConfig::default()
}

/// 保存配置
pub fn save_config(config: &AppConfig) -> Result<(), String> {
    let path = get_config_path();
    debug!("Saving config to: {:?}", path);

    let content = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    std::fs::write(&path, content)
        .map_err(|e| format!("Failed to write config file: {}", e))?;

    info!("Config saved successfully");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = AppConfig::default();
        assert_eq!(config.server.port, 9100);
        assert!(config.ui.start_minimized);
    }

    #[test]
    fn test_config_serialization() {
        let config = AppConfig::default();
        let json = serde_json::to_string(&config).unwrap();
        let parsed: AppConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(config.server.port, parsed.server.port);
    }
}
