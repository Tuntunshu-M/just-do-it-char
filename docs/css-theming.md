# 导演时间 CSS 主题

插件根节点为 `#st-proactive-director`，公开类名统一使用 `stpd-` 前缀。自定义 CSS 默认自动限制在根节点内；全局 CSS 模式会影响 SillyTavern 其他界面，仅在理解风险时启用。

稳定变量：`--stpd-bg`、`--stpd-panel`、`--stpd-text`、`--stpd-muted`、`--stpd-border`、`--stpd-accent`、`--stpd-danger`、`--stpd-radius`、`--stpd-gap`。

普通选择器会自动加上 `#st-proactive-director` 作用域。`@media` 和 `@supports` 内的普通选择器同样会被限制；`@keyframes` 和关键帧步骤不会被错误加前缀。只有在外观页明确启用“允许全局 CSS”并确认风险后，CSS 才会原样注入。
