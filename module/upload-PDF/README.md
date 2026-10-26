# 上传包

由 `web/scripts/pack.sh` 生成。

## 传什么

**把 `site/` 目录里的全部内容，传到网站根目录。** 就这一件事。

```sh
rsync -av --delete --exclude '.DS_Store' site/ user@服务器:/var/www/pdf/
```

大小 6.0M，开了 gzip 之后实际传输约 2 MB。
服务器上不需要 Node、不需要源码、不需要数据库。

`nginx.conf.example` 是配置示例，按注释改域名和证书路径即可。

## 要不要 proxy/

看你用哪个翻译服务 —— 浏览器直接调用它，所以它必须允许跨域。

| 服务 | 是否需要 proxy/ |
|---|---|
| DeepSeek、硅基流动、智谱、OpenRouter、OpenAI | **不需要**，删掉 proxy/ 即可 |
| 阿里云百炼（通义千问） | **需要** |

需要的话：

```sh
scp proxy/server.mjs user@服务器:/opt/pdf-proxy/
scp proxy/pdf-proxy.service user@服务器:/tmp/
# 服务器上：改 pdf-proxy.service 里的 ORIGIN 为你的站点地址
sudo cp /tmp/pdf-proxy.service /etc/systemd/system/
sudo systemctl enable --now pdf-proxy
```

然后放开 `nginx.conf.example` 末尾那段 `location /proxy/`，重载 Nginx，
最后在网页「设置」里把 Base URL 填成 `https://你的域名/proxy/v1`。

服务器需要 Node 18+。代理约 90 行、零依赖、不存储任何数据。

## 部署到子路径

要放在 `https://example.com/pdf/` 这种子路径下，得回源码改 `vite.config.js`：

```js
base: "/pdf/",     // 默认 "./"
```

改完重新跑 `./scripts/pack.sh`。不改会白屏。

## 访客数据去哪

PDF 与译文只在访客浏览器内存里，刷新即消失，**从不上传到你的服务器**。
即使用了 proxy，经过的也只是抽取出的文本（翻译本身绕不开），密钥原样转发不留存。

服务器上不产生任何用户数据。

---

更详细的说明见仓库里的 [web/DEPLOY.md](../DEPLOY.md)。
