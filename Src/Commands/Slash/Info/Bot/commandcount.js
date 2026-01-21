const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  name: "commandcount",
  description: "Display the total number of commands available in the bot",
  category: "Info",
  usage: "/info bot commandcount",
  cooldown: 10,

  data: new SlashCommandBuilder()
    .setName("commandcount")
    .setDescription(
      "Display the total number of commands available in the bot"
    ),

  async execute(client, interaction) {
    await interaction.deferReply();

    const totalCommands = client.slashCommands.size;

    // Group commands by category
    const categories = {};
    for (const [key, command] of client.slashCommands) {
      const category = command.category || "Uncategorized";
      categories[category] = (categories[category] || 0) + 1;
    }

    const sortedCategories = Object.entries(categories).sort(
      ([, a], [, b]) => b - a
    );

    // Format category breakdown
    let categoryDescription = "";
    for (const [category, count] of sortedCategories) {
      categoryDescription += `**${category}:** ${count} commands\n`;
    }

    const embed = new EmbedBuilder()
      .setTitle("📜 Command Statistics")
      .setColor(0x5865f2)
      .setDescription(
        `Here’s a summary of **${client.user.username}** commands:`
      )
      .addFields(
        {
          name: "📊 Total Commands",
          value: `**${totalCommands}**`,
          inline: true,
        },
        {
          name: "📁 Categories",
          value: `**${sortedCategories.length}**`,
          inline: true,
        },
        {
          name: "📈 Command Distribution",
          value: categoryDescription || "No commands found",
          inline: false,
        }
      )
      .setFooter({
        text: `Requested by ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};
