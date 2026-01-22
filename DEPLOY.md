# Vercel 部署指南

本指南将指导你如何将 CollabBoard 部署到 Vercel 平台。由于 `.env` 文件通常不会被提交到代码仓库，你需要手动配置环境变量。

## 1. 安装与登录

在项目根目录下打开终端（PowerShell 或 CMD），运行以下命令：

```bash
# 1. 登录 Vercel CLI
npx vercel login
```

*系统会通过浏览器引导你完成登录（支持 GitHub/GitLab/Email）。*

## 2. 初始化部署

登录成功后，运行部署命令：

```bash
# 2. 开始部署
npx vercel
```

CLI 会询问一系列问题，全选默认即可（按 Enter）：

- `Set up and deploy?` **[Y]**
- `Which scope do you want to deploy to?` **[你的用户名]**
- `Link to existing project?` **[N]**
- `What’s your project’s name?` **[collabboard]**
- `In which directory is your code located?` **[./]**
- `Want to modify these settings?` **[N]**

等待构建完成，你将获得一个 `Production` 网址（如 `https://collabboard-xyz.vercel.app`）。

## 3. ⚠️ 关键步骤：配置环境变量

**这是最重要的一步。** 默认部署后，实时协作功能会失效，因为云端没有配置 API Key。

1. 访问 Vercel 控制台: https://vercel.com/dashboard
2. 找到刚才创建的 **collabboard** 项目。
3. 进入 **Settings** -> **Environment Variables**。
4. 添加以下变量：
   - **Key**: `VITE_LIVEBLOCKS_PUBLIC_KEY`
   - **Value**: (复制你 `.env` 文件中的 `pk_live_...` 或 `pk_dev_...` 值)
5. 点击 **Save**。

## 4. 重新部署生效

配置完环境变量后，需要重新部署才能生效：

```bash
# 触发生产环境重新部署
npx vercel --prod
```

## 5. 完成 ✅

现在访问你的 Vercel 网址，实时协作白板应该可以正常工作了！
