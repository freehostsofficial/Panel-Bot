const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const config = require("../../../../config");

module.exports = {
  name: "help",
  description: "View all bot commands and information.",
  category: "Info",
  usage: "/info help [command]",
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("View all bot commands and information.")
    .addStringOption((option) =>
      option
        .setName("command")
        .setDescription("Get detailed info about a specific command")
        .setRequired(false)
        .setAutocomplete(true)
    ),

  isDeveloper(userId) {
    const developerIds = Array.isArray(config.get("settings.Developer.id"))
      ? config.get("settings.Developer.id").map(String)
      : config.get("settings.Developer.id")
      ? [String(config.get("settings.Developer.id"))]
      : [];
    return developerIds.includes(String(userId));
  },

  canViewCommand(cmd, isDev) {
    if (!cmd || !cmd.name) return false;
    if (cmd.developerOnly && !isDev) return false;
    if (cmd.ownerOnly && !isDev) return false;
    return true;
  },

  async autocomplete(interaction) {
    try {
      const focusedValue = interaction.options.getFocused().toLowerCase();
      const client = interaction.client;
      const isDev = this.isDeveloper(interaction.user.id);
      const commands = [];

      for (const [key, cmd] of client.slashCommands) {
        if (!this.canViewCommand(cmd, isDev)) continue;
        const parts = key.split(" ");
        const detectedCategory = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
        const category = cmd.category || detectedCategory;
        if (category === "Developer" && !isDev) continue;

        let displayName = "";
        if (parts.length === 3) displayName = `${parts[0]} ${parts[1]} ${parts[2]}`;
        else if (parts.length === 2) displayName = `${parts[0]} ${parts[1]}`;
        else displayName = parts[0];

        if (displayName) {
          commands.push({
            name: displayName,
            value: key,
            description: cmd.description || "No description",
          });
        }
      }

      const filtered = commands
        .filter((cmd) => cmd.name.toLowerCase().includes(focusedValue))
        .slice(0, 25);

      await interaction.respond(
        filtered.map((cmd) => ({
          name: `/${cmd.name} - ${cmd.description.substring(0, 60)}${cmd.description.length > 60 ? "..." : ""}`,
          value: cmd.value,
        }))
      );
    } catch {
      try { await interaction.respond([]); } catch {}
    }
  },

  async execute(client, interaction) {
    try {
      const commandQuery = interaction.options.getString("command");
      if (commandQuery) return await this.showCommandDetail(client, interaction, commandQuery);
      await this.showMainHelp(client, interaction);
    } catch {
      const errorMsg = { content: "❌ An error occurred while loading the help menu.", flags: 64 };
      if (interaction.deferred) await interaction.editReply(errorMsg);
      else await interaction.reply(errorMsg);
    }
  },

  async showCommandDetail(client, interaction, commandKey) {
    const isDev = this.isDeveloper(interaction.user.id);
    const cmd = interaction.client.slashCommands.get(commandKey);
    if (!cmd) return interaction.reply({ content: "❌ Command not found!", flags: 64 });
    if (!this.canViewCommand(cmd, isDev)) return interaction.reply({ content: "❌ You don't have permission to view this command!", flags: 64 });

    const parts = commandKey.split(" ");
    const fullPath = `/${parts.join(" ")}`;
    const embed = new EmbedBuilder()
      .setTitle(`📖 Command Information`)
      .setDescription(`**Command:** \`${fullPath}\`\n${cmd.description || "No description available."}`)
      .setColor("#5865F2")
      .addFields(
        { name: "📝 Usage", value: `\`${cmd.usage || fullPath}\``, inline: false },
        { name: "📂 Category", value: `${this.getCategoryEmoji(cmd.category || "Unknown")} \`${cmd.category || "Unknown"}\``, inline: true },
        { name: "⏱️ Cooldown", value: `\`${cmd.cooldown || 0} seconds\``, inline: true }
      )
      .setFooter({ text: `💡 Use /info help to see all commands`, iconURL: client.user.displayAvatarURL() })
      .setTimestamp();

    if (cmd.group) embed.addFields({ name: "🗂️ Subgroup", value: `${this.getSubgroupEmoji(cmd.group)} \`${cmd.group}\``, inline: true });

    const permFields = [];
    if (cmd.memberPermissions?.length) permFields.push({ name: "👤 Required User Permissions", value: cmd.memberPermissions.map(p => `\`${p}\``).join(", "), inline: false });
    if (cmd.botPermissions?.length) permFields.push({ name: "🤖 Required Bot Permissions", value: cmd.botPermissions.map(p => `\`${p}\``).join(", "), inline: false });
    if (permFields.length) embed.addFields(permFields);

    const flags = [];
    if (cmd.developerOnly) flags.push("👨‍💻 Developer Only");
    if (cmd.ownerOnly) flags.push("👑 Owner Only");
    if (cmd.guildOnly) flags.push("🏢 Server Only");
    if (cmd.dmOnly) flags.push("💬 DM Only");
    if (cmd.nsfwOnly) flags.push("🔞 NSFW Only");
    if (cmd.vcOnly) flags.push("🎤 Voice Channel Required");
    if (cmd.mainServerOnly) flags.push("🏠 Main Server Only");
    if (cmd.maintenanceCmd) flags.push("🔧 Under Maintenance");
    if (cmd.toggleOffCmd) flags.push("🚫 Currently Disabled");
    if (flags.length) embed.addFields({ name: "🚩 Special Requirements", value: flags.join("\n"), inline: false });

    const backButton = new ButtonBuilder().setCustomId("help_home").setLabel("Back to Home").setStyle(ButtonStyle.Secondary).setEmoji("🏠");
    const row = new ActionRowBuilder().addComponents(backButton);
    await interaction.reply({ embeds: [embed], components: [row] });

    const response = await interaction.fetchReply();
    const collector = response.createMessageComponentCollector({ time: 300000 });
    collector.on("collect", async (i) => { if (i.user.id === interaction.user.id && i.customId === "help_home") { await i.deferUpdate(); await this.showMainHelp(client, i, true); } });
    collector.on("end", () => { try { interaction.editReply({ components: [] }).catch(() => {}); } catch {} });
  },

  async showMainHelp(client, interaction, isUpdate = false) {
    const isDev = this.isDeveloper(interaction.user.id);
    const categories = new Map();

    for (const [key, cmd] of client.slashCommands) {
      if (!this.canViewCommand(cmd, isDev)) continue;
      const parts = key.split(" ");
      const detectedCategory = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
      const category = cmd.category || detectedCategory;
      if (category === "Developer" && !isDev) continue;

      if (!categories.has(category)) categories.set(category, new Map());
      const categoryMap = categories.get(category);
      const subgroup = cmd.group || (parts.length === 3 ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : "General");
      if (!categoryMap.has(subgroup)) categoryMap.set(subgroup, []);
      categoryMap.get(subgroup).push({ name: cmd.name, description: cmd.description, key });
    }

    const homeEmbed = new EmbedBuilder()
      .setTitle(`✨ ${client.user.username} - Help Menu`)
      .setDescription("Welcome! Select a category below to view commands.\n💡 Use `/info help <command>` for details.")
      .setColor("#5865F2")
      .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
      .setFooter({ text: `👤 Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    const statsValue = [
      `**🏓 Ping:** \`${client.ws.ping}ms\``,
      `**⚡ Commands:** \`${Array.from(categories.values()).reduce((a, cat) => a + Array.from(cat.values()).reduce((b, cmds) => b + cmds.length, 0), 0)}\``,
      `**📂 Categories:** \`${categories.size}\``,
      `**🏢 Servers:** \`${client.guilds.cache.size}\``,
      `**👥 Users:** \`${client.users.cache.size}\``,
    ];
    if (isDev) statsValue.push(`**👨‍💻 Developer Mode:** \`Active\``);

    homeEmbed.addFields(
      { name: "📊 Bot Statistics", value: statsValue.join("\n"), inline: true },
      { name: "📚 Available Categories", value: Array.from(categories.keys()).map(cat => `${this.getCategoryEmoji(cat)} \`${cat}\``).join("\n") || "None", inline: false }
    );

    const categoryOptions = Array.from(categories.keys()).map(cat => {
      const commandCount = Array.from(categories.get(cat).values()).reduce((a, cmds) => a + cmds.length, 0);
      return { label: cat, description: `${commandCount} command${commandCount !== 1 ? 's' : ''}`, value: `category_${cat}`, emoji: this.getCategoryEmoji(cat) };
    });

    const selectMenu = new StringSelectMenuBuilder().setCustomId("help_category_select").setPlaceholder("🔎 Choose a category").addOptions(categoryOptions);
    const homeButton = new ButtonBuilder().setCustomId("help_home").setLabel("🏠 Home").setStyle(ButtonStyle.Primary).setEmoji("🏠").setDisabled(true);
    const menuRow = new ActionRowBuilder().addComponents(selectMenu);
    const buttonRow = new ActionRowBuilder().addComponents(homeButton);

    const responseData = { embeds: [homeEmbed], components: [menuRow, buttonRow] };
    if (isUpdate) { await interaction.editReply(responseData); } else { await interaction.reply(responseData); }

    const response = await interaction.fetchReply();
    const collector = response.createMessageComponentCollector({ time: 300000 });

    const categoryNames = Array.from(categories.keys());
    let categoryIndex = 0, subPageIndex = 0;

    collector.on("collect", async (i) => {
      if (i.user.id !== interaction.user.id) return i.reply({ content: "❌ This help menu is not for you!", flags: 64 });
      await i.deferUpdate();

      if (i.customId === "help_home") { categoryIndex = 0; subPageIndex = 0; await this.showMainHelp(client, i, true); }
      else if (i.customId === "help_category_select") { categoryIndex = categoryNames.indexOf(i.values[0].replace("category_", "")); subPageIndex = 0; await this.showCategoryPage(i, client, categories, categoryNames[categoryIndex], categoryIndex, subPageIndex, menuRow); }
      else if (i.customId === "help_prev") { if (subPageIndex > 0) subPageIndex--; else if (categoryIndex > 0) { categoryIndex--; subPageIndex = 0; } await this.showCategoryPage(i, client, categories, categoryNames[categoryIndex], categoryIndex, subPageIndex, menuRow); }
      else if (i.customId === "help_next") {
        const categoryMap = categories.get(categoryNames[categoryIndex]);
        const totalSubgroups = Array.from(categoryMap.values()).length;
        const maxFields = 10;
        const totalPages = Math.ceil(totalSubgroups / maxFields);
        if (subPageIndex < totalPages - 1) subPageIndex++; else if (categoryIndex < categoryNames.length - 1) { categoryIndex++; subPageIndex = 0; }
        await this.showCategoryPage(i, client, categories, categoryNames[categoryIndex], categoryIndex, subPageIndex, menuRow);
      }
    });

    collector.on("end", () => { try { interaction.editReply({ components: [] }).catch(() => {}); } catch {} });
  },

  async showCategoryPage(interaction, client, categories, categoryName, pageIndex, subPageIndex, menuRow) {
    const categoryMap = categories.get(categoryName);
    if (!categoryMap) return;

    const subgroups = Array.from(categoryMap.entries());
    const maxFields = 10;
    const pages = [];

    let currentPage = [], fieldCount = 0;
    for (const [subgroupName, commands] of subgroups) {
      const commandList = commands.map(c => `\`${c.name}\``).join(" • ") || "No commands";
      const field = { name: `${this.getSubgroupEmoji(subgroupName)} ${subgroupName}`, value: commandList, inline: false };
      if (fieldCount + 1 > maxFields) { pages.push(currentPage); currentPage = []; fieldCount = 0; }
      currentPage.push(field);
      fieldCount++;
    }
    if (currentPage.length) pages.push(currentPage);

    const pageFields = pages[subPageIndex] || [];
    const embed = new EmbedBuilder()
      .setTitle(`${this.getCategoryEmoji(categoryName)} ${categoryName} Commands`)
      .setDescription(`Showing **${categoryName}** commands. Use \`/info help <command>\` for details.`)
      .setColor("#5865F2")
      .setFooter({ text: `📄 Page ${subPageIndex + 1}/${pages.length} • ${subgroups.length} subgroup(s) total`, iconURL: client.user.displayAvatarURL() })
      .setTimestamp()
      .addFields(pageFields);

    const prevButton = new ButtonBuilder().setCustomId("help_prev").setLabel("◀️ Prev").setStyle(ButtonStyle.Secondary).setDisabled(subPageIndex === 0 && pageIndex === 0);
    const homeButton = new ButtonBuilder().setCustomId("help_home").setLabel("🏠 Home").setStyle(ButtonStyle.Primary);
    const nextButton = new ButtonBuilder().setCustomId("help_next").setLabel("Next ▶️").setStyle(ButtonStyle.Secondary).setDisabled(subPageIndex === pages.length - 1 && pageIndex === categories.size - 1);

    const buttonRow = new ActionRowBuilder().addComponents(prevButton, homeButton, nextButton);
    await interaction.editReply({ embeds: [embed], components: [menuRow, buttonRow] });
  },

  getCategoryEmoji(category) {
    const emojiMap = { Economy: "💰", Moderation: "🛡️", Fun: "🎮", Utility: "🔧", Music: "🎵", Info: "ℹ️", Admin: "⚙️", Social: "👥", Leveling: "📊", Games: "🎲", Configuration: "🔩", Tickets: "🎫", Logs: "📝", Welcome: "👋", Giveaway: "🎁", Reaction: "⭐", Verification: "✅", Automod: "🤖", Custom: "🎨", Developer: "👨‍💻", Owner: "👑" };
    return emojiMap[category] || "📁";
  },

  getSubgroupEmoji(subgroup) {
    const emojiMap = { General: "📌", Profile: "👤", Shop: "🛒", Work: "💼", Inventory: "🎒", Games: "🎮", Casino: "🎰", Fishing: "🎣", Hunting: "🏹", Mining: "⛏️", Farming: "🌾", Trading: "🔄", Leaderboard: "🏆", Settings: "⚙️", Management: "📋", Moderation: "🔨", Tickets: "🎫", Logs: "📜", Filter: "🔍", Auto: "🤖", Music: "🎵", Queue: "📜", Playlist: "📋", Fun: "😄", Image: "🖼️", Memes: "😂", Anime: "🎌", Search: "🔎", Info: "📖", User: "👥", Server: "🏠", Role: "🎭", Channel: "💬", Emoji: "😀", Stats: "📊", Level: "⬆️", Rank: "🏅", Rewards: "🎁", Config: "🔧", Setup: "🛠️", Reset: "🔄", Import: "📥", Export: "📤" };
    return emojiMap[subgroup] || "▸";
  },
};
