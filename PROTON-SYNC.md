# Proton 文库自动目录

目标：Proton 是原件的唯一下载渠道。网站仅公开书目和指向每个文件的 Proton 分享链接，不保存或代理下载原件。

## 数据流

1. 管理者向 Proton 的“林办档案馆”文件夹及其子目录上传文件。
2. 本机同步程序用已授权的官方 Proton Drive CLI 递归读取元数据，排除“彪丝创作”。
3. 为文件创建只读单文件分享链接，密码在内存中读取自源文件夹，并核验角色、密码和 URL。公开书目不包含密码。
4. 按 Proton 文件 UID 关联条目，更新本机 SQLite，再导出静态网站。
5. 通过 GitHub API 把明确允许的七个静态文件发布到 `gh-pages` 分支。原件、后台、SQLite、账户信息、授权凭据及同步状态均不发布。
6. GitHub Pages 根据 `gh-pages` 分支更新网站。

网站与同步程序独立：电脑关机后公网网站仍可访问，但新文件需等待电脑开机、用户登录且联网后才能更新。计划任务每 15 分钟尝试一次；执行中的任务不重叠。首次全库分享或每天的链接审计可能超过这个间隔。

## 授权与运行

安装 [Proton 官方 CLI](https://proton.me/download/drive/cli/index.html)，核验官方校验和，在当前 Windows 用户下运行 `proton-drive auth login`。授权保存在操作系统凭据管理器中。另需 Node.js 24+ 和已授权该仓库的 GitHub CLI (`gh`)。

同步程序必须与授权使用同一个 Windows 用户运行。不要把账户密码放入脚本、仓库、命令行或计划任务。源分享密码只在 CLI 调用期间通过内存参数传递；本机有权限检查进程的用户可能看到这一分享密码，不能据此声称本机凭据隔离。

一次同步和发布（占位路径需替换）：

```powershell
powershell -NoProfile -File scripts/sync-and-publish.ps1 -NodePath 'C:\path\node.exe' -ProtonCliPath 'C:\path\proton-drive.exe'
```

若网络需要代理，可追加 `-ProxyUrl 'http://127.0.0.1:7897'`。不需要代理时省略。

安装后台任务：使用相同参数运行 `scripts/install-sync-task.ps1`。任务名为 `ArchiveOfLin-ProtonSync`，只在当前用户登录期间运行，隐藏窗口，不要求存储 Windows 密码。

暂停或移除（不会删除 Proton 文件）：

```powershell
Disable-ScheduledTask -TaskName 'ArchiveOfLin-ProtonSync'
Unregister-ScheduledTask -TaskName 'ArchiveOfLin-ProtonSync' -Confirm:$false
```

## 编号、版本与失败处理

- 已有 `LB-00001` 等编号按原文件名和分类匹配后保留。后续通过 Proton UID 识别，移动或改名不改编号。
- 分类随 Proton 顶层目录更新；已移除且没有公开条目的旧分类不再展示，后台保留历史分类。
- 新编号 `LB-P` + 文件 UID 的 SHA-256 前 16 位十六进制，是稳定标识，不代表日期、类别或排序；同名不同文件各有独立编号。
- 自动生成的书名来自文件名；不猜测作者或年代。人工作者、标题、说明保留。
- 每次目录扫描均须完整成功。扫描失败不执行“文件消失”判断，也不发布未完成的静态结果。
- 分享创建按文件保存进度，失败可重跑。每份分享验证后才写入书目，密码或权限不符合要求时停止。已有链接在一天内可复用，至少每天重新检查；整库文件夹密码改变时重新设置。
- 已同步文件移出指定目录或删除后，下一次完整扫描将条目归档。程序不删除 Proton 文件，也不撤销已存在的独立分享链接。若需彻底停止文件访问，还需在 Proton 撤销对应分享。
- 人工归档保留；从暂时消失状态恢复的条目可再次发布。
- 文献版本由 Proton 保存；本站保存书目修订。原件不会进入 Git 历史。
- `data/proton-sync/last-run.log` 记录最近一次任务；`state.json` 保存关联关系，均已忽略。每日首次同步前备份 SQLite 到 `data/backups/`，需自行定期整理备份空间。
- 进程异常退出可能遗留 `data/proton-sync/running.lock`。先确认同步进程已停止，再手动移除此锁；不要在运行期间移除。
- GitHub 发布失败时保留本地结果，下次任务可重试。部署还存在 GitHub Pages 构建延迟。

## 明确边界

这是一条从 Proton 到网站的元数据同步链路，不是原件双向同步。不从网站上传、修改或删除 Proton 原件；网站不会接收 Proton 账户密码。分享链接有密码并不意味着无法转发，也不保证维护者不可追溯。
