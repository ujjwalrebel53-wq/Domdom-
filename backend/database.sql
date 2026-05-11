-- Rebel AI Admin Panel Database Schema

CREATE DATABASE IF NOT EXISTS rebel_ai_admin;
USE rebel_ai_admin;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE,
  password VARCHAR(255),
  ip VARCHAR(50),
  role ENUM('User', 'VIP', 'Admin') DEFAULT 'User',
  status ENUM('active', 'inactive') DEFAULT 'active',
  joined DATE,
  messages INT DEFAULT 0,
  device VARCHAR(50),
  login_count INT DEFAULT 0,
  last_login DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (email),
  INDEX (status)
);

-- API Keys Table
CREATE TABLE IF NOT EXISTS api_keys (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  key_value VARCHAR(255) UNIQUE NOT NULL,
  perms VARCHAR(100),
  usage INT DEFAULT 0,
  max_limit INT DEFAULT 1000,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (status)
);

-- Messages Table
CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_email VARCHAR(100),
  type VARCHAR(50),
  response_time INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (user_email),
  INDEX (created_at)
);

-- API Logs Table
CREATE TABLE IF NOT EXISTS api_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  response_time INT,
  success BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (created_at)
);

-- System Logs Table
CREATE TABLE IF NOT EXISTS logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  level ENUM('info', 'warn', 'error') DEFAULT 'info',
  msg TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (level),
  INDEX (created_at)
);

-- Settings Table
CREATE TABLE IF NOT EXISTS settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value LONGTEXT,
  PRIMARY KEY (key)
);

-- Analytics Table
CREATE TABLE IF NOT EXISTS analytics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(100),
  user_agent VARCHAR(255),
  ip VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (session_id),
  INDEX (created_at)
);

-- Insert default admin user
INSERT IGNORE INTO users (name, email, role, status, joined, device) VALUES 
('Rebel Bhaiya', 'admin@rebel.ai', 'Admin', 'active', CURDATE(), 'Desktop');

-- Insert default API keys
INSERT IGNORE INTO api_keys (name, key_value, perms, max_limit, status) VALUES
('Primary GPT-5', 'rbx_PRIMARYKEY123456', 'Read, Write', 5000, 'active'),
('Image API', 'rbx_IMAGEKEY789012', 'Read Only', 2000, 'active'),
('Dev Test Key', 'rbx_DEVTESTKEY345678', 'Read, Write', 500, 'inactive');

-- Insert default settings
INSERT IGNORE INTO settings (key, value) VALUES
('system_prompt', 'You are Rebel Gpt, an advanced AI assistant created by Rebel bhaiya. You are helpful, rebellious, and expert in coding.'),
('admin_password', 'rebel@admin123'),
('app_name', 'Rebel AI'),
('maintenance_mode', 'false');

-- Insert sample logs
INSERT INTO logs (level, msg) VALUES
('info', 'System initialized'),
('info', 'Admin login'),
('info', 'Database connection established');
