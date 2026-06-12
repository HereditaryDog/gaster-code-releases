# 发布远端卫生

源码工作区可能会同时保留多个 remote：

- `origin`：私有源码仓库，也是源码 tag 的权威来源。
- `public-releases`：只用于发布和 updater 资产的公开发布仓库。
- `colleague`：用于借用同事 GitHub Actions 额度构建安装包的 fork。

不要在源码工作区里带着 tag 拉取所有 remote。发布专用仓库有自己的提交历史，同名 tag 可能指向不同对象。

## 安全拉取

日常源码开发使用不导入 tag 的 fetch：

```bash
git fetch origin --prune --no-tags
git fetch --all --prune --no-tags
```

如果本地 clone 保留了 `public-releases` 或 `colleague` 这类额外 remote，关闭自动 tag 导入，并让它们跳过 `fetch --all`：

```bash
git config remote.public-releases.tagOpt --no-tags
git config remote.colleague.tagOpt --no-tags
git config remote.public-releases.skipFetchAll true
git config remote.colleague.skipFetchAll true
```

只查看发布仓库 tag 时，使用 `ls-remote`，不要导入到源码仓库的本地 tag 命名空间：

```bash
git ls-remote --tags public-releases
```

## 发布推送

release 脚本每次只创建一个版本 tag。推送时只推 `main` 和这一个 tag：

```bash
git push origin main vX.Y.Z
```

避免执行 `git push origin main --tags`。本地维护过多个 remote 后，clone 里可能混有不同历史来源的 tag。

## 同事 Fork 同步

使用同事 fork 构建安装包前，把它的 `main` 精确同步到 `origin/main`。推荐先备份旧 main，再用精确 lease 推送：

```bash
git push colleague <old-colleague-main>:refs/heads/backup/main-before-origin-sync-YYYY-MM-DD
git push --force-with-lease=refs/heads/main:<old-colleague-main> \
  colleague origin/main:refs/heads/main
```

只推送本次构建需要的源码 release tag：

```bash
git push colleague refs/tags/vX.Y.Z:refs/tags/vX.Y.Z
```

不要把本地所有 tag 推到同事 fork。

## 不要这样做

```bash
git fetch --all --prune --tags
git push colleague --tags
git push --mirror colleague
git push --force public-releases refs/tags/vX.Y.Z
```

不要从源码工作区重写 `public-releases` 的 tag。它是另一条发布专用历史。
