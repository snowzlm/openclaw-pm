# 贡献指南

感谢你对 OpenClaw PM 的关注！我们欢迎任何形式的贡献。

## 如何贡献

### 报告 Bug

如果你发现了 Bug，请：

1. 检查 [Issues](https://github.com/snowzlm/openclaw-pm/issues) 是否已有相同问题
2. 如果没有，创建新 Issue，包含：
   - 问题描述
   - 复现步骤
   - 预期行为
   - 实际行为
   - 系统环境（OS、Shell 版本等）
   - 相关日志

### 提出新功能

如果你有新功能建议：

1. 创建 Issue，标记为 `enhancement`
2. 描述功能需求和使用场景
3. 等待社区讨论

### 提交代码

#### 开发环境

```bash
# 1. Fork 仓库
# 2. 克隆你的 Fork
git clone https://github.com/YOUR_USERNAME/openclaw-pm.git
cd openclaw-pm

# 3. 添加上游仓库
git remote add upstream https://github.com/snowzlm/openclaw-pm.git

# 4. 创建分支
git checkout -b feature/your-feature-name
```

#### 开发规范

**1. 脚本规范**

所有脚本必须：
- 使用 `scripts/lib/common.sh` 工具库
- 从 `scripts/config.json` 读取配置
- 支持跨平台（macOS + Linux）
- 添加错误处理
- 添加依赖检查

示例：
```bash
#!/bin/bash
set -e

# 加载工具库
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# 初始化
init_common

# 检查依赖
check_required_dependencies

# 你的代码...
```

**2. 配置管理**

不要硬编码配置，使用 `config.json`：

```bash
# ❌ 错误
PORT=18789

# ✅ 正确
PORT=$(get_config_value "gateway.port" "18789")
```

**3. 跨平台兼容**

使用 `lib/common.sh` 提供的函数：

```bash
# ❌ 错误（仅 Linux）
stat -c %Y "$file"

# ✅ 正确（跨平台）
get_file_mtime "$file"
```

**4. 错误处理**

```bash
# 使用 set -e
set -e

# 检查命令是否存在
if ! check_command "jq"; then
    echo "Error: jq not found"
    exit 1
fi

# 检查文件是否存在
if [ ! -f "$file" ]; then
    echo "Error: file not found"
    exit 1
fi
```

**5. 备份机制**

删除文件前必须备份：

```bash
# 创建备份
create_backup "$file" "cleanup"

# 删除文件
rm "$file"
```

**6. 通知系统**

重要操作发送通知：

```bash
notify "info" "操作成功"
notify "warn" "发现问题"
notify "error" "操作失败"
```

#### 代码风格

- 使用 4 空格缩进
- 函数名使用 snake_case
- 变量名使用 snake_case
- 常量使用 UPPER_CASE
- 添加注释说明复杂逻辑

#### 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type**:
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `test`: 测试
- `chore`: 构建/工具链

**示例**:
```
feat(health-check): 添加磁盘空间检查

- 检查磁盘使用率
- 超过 80% 发出警告
- 超过 90% 发出错误

Closes #123
```

#### 测试

提交前测试：

```bash
# 1. 运行所有脚本
./scripts/quick-diagnose.sh
./scripts/gateway-health-check.sh
./scripts/morning-briefing.sh

# 2. 检查语法
bash -n scripts/*.sh

# 3. 在不同系统测试（如果可能）
# - Linux
# - macOS
```

#### 提交 PR

```bash
# 1. 提交更改
git add .
git commit -m "feat: your feature"

# 2. 推送到你的 Fork
git push origin feature/your-feature-name

# 3. 在 GitHub 创建 Pull Request
```

PR 描述应包含：
- 更改内容
- 相关 Issue
- 测试结果
- 截图（如果适用）

---

## 开发工具

### 推荐工具

- **编辑器**: VS Code + ShellCheck 插件
- **Shell 检查**: shellcheck
- **JSON 格式化**: jq

### 安装 ShellCheck

```bash
# macOS
brew install shellcheck

# Linux
sudo apt-get install shellcheck  # Debian/Ubuntu
sudo yum install shellcheck      # CentOS/RHEL
```

### 使用 ShellCheck

```bash
# 检查单个文件
shellcheck scripts/gateway-health-check.sh

# 检查所有脚本
find scripts -name "*.sh" -exec shellcheck {} \;
```

---

## 文档贡献

文档同样重要！你可以：

- 修正错误
- 改进说明
- 添加示例
- 翻译文档

文档位于：
- `README.md` - 主文档
- `INSTALL.md` - 安装指南
- `docs/archive/changelog/CHANGELOG-v3.md` - 变更日志
- `docs/` - 详细文档

---

## 发布流程

（仅维护者）

### 版本号规则

遵循 [Semantic Versioning](https://semver.org/)：

- `MAJOR.MINOR.PATCH`
- `MAJOR`: 破坏性变更
- `MINOR`: 新功能（向后兼容）
- `PATCH`: Bug 修复

### 发布步骤

```bash
# 1. 更新版本号
vim package.json  # 修改 version

# 2. 更新 CHANGELOG
vim docs/archive/changelog/CHANGELOG-v3.md

# 3. 提交
git add .
git commit -m "chore: release v3.x.x"

# 4. 打标签
git tag -a v3.x.x -m "Release v3.x.x"

# 5. 推送
git push origin main --tags

# 6. 发布到 NPM（可选）
npm publish
```

---

## 行为准则

### 我们的承诺

为了营造开放和友好的环境，我们承诺：

- 尊重不同观点和经验
- 接受建设性批评
- 关注对社区最有利的事情
- 对其他社区成员表示同理心

### 不可接受的行为

- 使用性化的语言或图像
- 人身攻击或侮辱性评论
- 公开或私下骚扰
- 未经许可发布他人私人信息
- 其他不道德或不专业的行为

### 执行

违反行为准则的行为可能导致：
- 警告
- 临时禁止
- 永久禁止

---

## 许可证

贡献的代码将使用 MIT License。

---

## 联系方式

- **GitHub Issues**: https://github.com/snowzlm/openclaw-pm/issues
- **原项目**: https://github.com/1va7/openclaw-pm

---

## 致谢

感谢所有贡献者！

特别感谢：
- VA7 - 原作者
- 所有提交 Issue 和 PR 的贡献者
