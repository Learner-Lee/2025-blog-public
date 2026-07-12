# 建立可远程访问的 PostgreSQL 数据库

## 1. 安装 PostgreSQL

**Ubuntu/Debian:**

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

**CentOS/RHEL:**

```bash
sudo dnf install postgresql-server postgresql-contrib
sudo postgresql-setup --initdb
```

## 2. 配置监听地址

编辑主配置文件（路径可能因版本而异，如 `/etc/postgresql/16/main/postgresql.conf`）：

```bash
sudo find /etc/postgresql -name postgresql.conf
```

找到并修改：

```conf
listen_addresses = '*'      # 监听所有网卡；生产环境建议改为具体内网IP
port = 5432
```

## 3. 配置客户端认证规则

编辑同目录下的 `pg_hba.conf`，添加允许远程连接的规则：

```conf
# TYPE  DATABASE        USER            ADDRESS                 METHOD
host    all             all             0.0.0.0/0               scram-sha-256
```

> ⚠️ `0.0.0.0/0` 表示允许任意 IP，**仅用于测试**。生产环境务必改成具体网段，如：
>
> ```conf
> host    mydb            myuser          203.0.113.0/24          scram-sha-256
> ```

确认加密方式为 scram-sha-256（更安全），在 `postgresql.conf` 中设置：

```conf
password_encryption = scram-sha-256
```

## 4. 重启服务

```bash
sudo systemctl restart postgresql
sudo systemctl enable postgresql
```

## 5. 创建数据库和用户

```bash
sudo -u postgres psql
```

```sql
CREATE DATABASE mydb;
CREATE USER Alen WITH ENCRYPTED PASSWORD 'Aa@123456';
GRANT ALL PRIVILEGES ON DATABASE mydb TO Alen;
```

## 6. 开放防火墙端口

**ufw (Ubuntu):**

```bash
sudo ufw allow 5432/tcp
```

**firewalld (CentOS):**

```bash
sudo firewall-cmd --permanent --add-port=5432/tcp
sudo firewall-cmd --reload
```

如果是云服务器（AWS/阿里云/GCP 等），还需在**安全组/防火墙控制台**里放行 5432 端口的入站规则。

## 7. 安装客户端（在用来连接的机器上）

远程连接不需要在客户端装整个 PostgreSQL 服务，只需要 `psql` 命令行工具。

**Ubuntu/Debian:**

```bash
sudo apt update
sudo apt install postgresql-client
```

> 如果执行 `psql` 报错 `Error: You must install at least one postgresql-client-<version> package`，
> 说明系统只装了 `postgresql-client-common`（一个空壳包/wrapper），并没有装真正带二进制的
> `postgresql-client-<version>`（如 `postgresql-client-16`）。用上面的命令装 `postgresql-client`
> 元包即可自动拉取匹配的版本。

**CentOS/RHEL:**

```bash
sudo dnf install postgresql
```

**macOS (Homebrew):**

```bash
brew install libpq
brew link --force libpq
```

**Windows:** 安装 [PostgreSQL 官方安装包](https://www.postgresql.org/download/windows/) 时勾选 "Command Line Tools"，或用 `winget install PostgreSQL.PostgreSQL`。

## 8. 测试远程连接

在客户端机器上：

```bash
psql -h <服务器IP> -U Alen -d mydb -p 5432
```

例如：

```bash
psql -h 100.111.57.50 -U Alen -d mydb -p 5432
```

## 安全建议（重要）

1. **限制来源 IP**：不要用 `0.0.0.0/0`，只放行需要连接的固定 IP 或跳板机。
2. **启用 SSL**：在 `postgresql.conf` 设置 `ssl = on`，并在 `pg_hba.conf` 用 `hostssl` 替代 `host`。
3. **强密码 + 最小权限**：不要用 postgres 超级用户远程连接，为每个应用创建独立账号并只授予必要权限。
4. **考虑用 SSH 隧道或 VPN** 代替直接暴露 5432 端口：

   ```bash
   ssh -L 5432:localhost:5432 user@your-server
   ```

   然后本地连接 `localhost:5432` 即可，无需公开端口。
5. **定期备份**，并监控异常连接日志（`log_connections = on`）。
