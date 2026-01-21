const { SlashCommandBuilder, EmbedBuilder, Colors } = require("discord.js");

module.exports = {
  name: "boostinfo",
  description: "Display server boost information",
  category: "Info",
  usage: "/info server boostinfo",
  cooldown: 10,
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName("boostinfo")
    .setDescription("Shows server boost stats and tier"),

  async execute(client, interaction) {
    await interaction.deferReply();

    const guild = interaction.guild;
    const boosters = guild.members.cache.filter(m => m.premiumSince);

    const embed = new EmbedBuilder()
      .setTitle(`🚀 Boost Info`)
      .setColor(Colors.Gold)
      .setDescription(`**${guild.name}**`)
      .addFields(
        {
          name: "✨ Boost Stats",
          value: [
            `**Tier:** ${guild.premiumTier}`,
            `**Boosts:** ${guild.premiumSubscriptionCount || 0}`,
            `**Boosters:** ${boosters.size}`,
          ].join("\n"),
          inline: true,
        },
        {
          name: "💎 Active Boosters",
          value:
            boosters.size > 0
              ? boosters
                  .map(m => `• ${m.user.tag}`)
                  .slice(0, 10)
                  .join("\n")
              : "None",
          inline: true,
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
