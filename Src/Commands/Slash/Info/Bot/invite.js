const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

module.exports = {
  name: "invite",
  description: "Get the bot invite link.",
  category: "Info",
  usage: "/info bot invite",
  cooldown: 10,
  devOnly: false,

  data: new SlashCommandBuilder()
    .setName("invite")
    .setDescription("Invite the bot to your server."),

  async execute(client, interaction) {
    await interaction.deferReply();

    const inviteURL = `https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`;

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle("🔗 Invite Me")
      .setDescription(
        `Click the button below to invite **${client.user.username}** to your server.`
      )
      .setFooter({
        text: `Requested by ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
      })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Invite Bot")
        .setStyle(ButtonStyle.Link)
        .setURL(inviteURL)
        .setEmoji("➕")
    );

    return interaction.editReply({
      embeds: [embed],
      components: [row],
    });
  },
};
