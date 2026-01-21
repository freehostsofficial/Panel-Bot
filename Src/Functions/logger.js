const { EmbedBuilder, WebhookClient } = require("discord.js");
const config = require("../../config");
const { sanitizeForLogging } = require("./security-utils");

class WebhookPool {
  constructor(maxSize = 10) {
    this.pool = new Map();
    this.maxSize = maxSize;
  }

  get(url) {
    if (!url?.startsWith("http")) return null;
    if (this.pool.has(url)) return this.pool.get(url);
    if (this.pool.size >= this.maxSize) this.pool.delete(this.pool.keys().next().value);
    try {
      const hook = new WebhookClient({ url });
      this.pool.set(url, hook);
      return hook;
    } catch {
      return null;
    }
  }
}

class DiscordLogger {
  constructor() {
    this.webhooks = new WebhookPool();
  }

  getConfig(type) {
    const base = config.get(`logs.${type}Logs`, {});
    return {
      enabled: base.enabled !== false,
      webhook: base.webhook || config.get("logs.defaultWebhook"),
      channelId: base.channelId || config.get("logs.defaultChannelId"),
    };
  }

  formatStack(stack) {
    if (!stack) {
      return null;
    }
    
    // In production, limit stack trace length and remove file paths
    let processedStack = stack;
    if (process.env.NODE_ENV === 'production') {
      // Only show first 3 lines of stack
      const lines = stack.split('\n').slice(0, 3);
      // Remove absolute file paths
      processedStack = lines.map(line => 
        line.replace(/\/[^\s]+\//g, '.../').replace(/\\[^\s]+\\/g, '...\\\\')  
      ).join('\n');
    }
    
    const chunks = [];
    for (let i = 0; i < processedStack.length; i += 1000) {
      chunks.push(processedStack.slice(i, i + 1000));
    }
    return chunks.map((text, idx) => ({ name: idx === 0 ? "Stack Trace" : "\u200b", value: `\`\`\`${text}\`\`\`` }));
  }

  async send({ client, type = "error", title, description, fields, embed, error }) {
    const cfg = this.getConfig(type);
    if (!cfg.enabled) {
      return false;
    }

    const baseEmbed = embed instanceof EmbedBuilder ? embed : new EmbedBuilder().setTimestamp();
    if (title) {
      baseEmbed.setTitle(title);
    }
    if (description) {
      baseEmbed.setDescription(description);
    }

    // Sanitize fields before logging
    let finalFields = Array.isArray(fields) ? fields.map(f => ({
      ...f,
      value: typeof f.value === 'string' ? f.value : JSON.stringify(sanitizeForLogging(f.value))
    })) : [];
    
    if (error) {
      finalFields.push(...this.formatStack(error.stack || String(error)));
    }
    
    baseEmbed.addFields(finalFields.slice(0, 25));

    if (cfg.webhook) {
      const hook = this.webhooks.get(cfg.webhook);
      if (hook) {
        await hook.send({ embeds: [baseEmbed] });
        return true;
      }
    }

    if (cfg.channelId && client?.channels) {
      const channel = await client.channels.fetch(cfg.channelId).catch(() => null);
      if (channel?.isTextBased()) {
        await channel.send({ embeds: [baseEmbed] });
        return true;
      }
    }

    return false;
  }

  error(opts)   { return this.send({ ...opts, type: "error" }); }
  command(opts) { return this.send({ ...opts, type: "command" }); }
  guild(opts)   { return this.send({ ...opts, type: "guild" }); }
  client(opts)  { return this.send({ ...opts, type: "client" }); }
  ban(opts)     { return this.send({ ...opts, type: "ban" }); }
  server(opts)  { return this.send({ ...opts, type: "server" }); }
}

module.exports = { logger: new DiscordLogger() };
