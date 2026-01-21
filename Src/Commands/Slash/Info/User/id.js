const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  name: "userid",
  description: "Get a user's Discord ID",
  category: "Info",
  usage: "/info user id [user]",
  cooldown: 5,
  devOnly: false,

  data: new SlashCommandBuilder()
    .setName("id")
    .setDescription("Get a user's Discord ID")
    .addUserOption((option) =>
      option.setName("user").setDescription("Select a user").setRequired(false)
    ),

  async execute(client, interaction) {
    await interaction.deferReply();

    const user = interaction.options.getUser("user") || interaction.user;

    const embed = new EmbedBuilder()
      .setTitle("🆔 User ID")
      .setColor(0x5865f2)
      .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
      .setDescription(`**${user.tag}**`)
      .addFields(
        {
          name: "User ID",
          value: `\`\`\`\n${user.id}\n\`\`\``,
          inline: false,
        },
        {
          name: "Bot Account",
          value: user.bot ? "Yes 🤖" : "No 👤",
          inline: true,
        },
        {
          name: "Account Created",
          value: `<t:${Math.floor(
            user.createdTimestamp / 1000
          )}:F>\n(<t:${Math.floor(user.createdTimestamp / 1000)}:R>)`,
          inline: false,
        }
      )
      .setFooter({
        text: `Requested by ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setTimestamp();

    return interaction.editReply({
      embeds: [embed],
    });
  },
};
