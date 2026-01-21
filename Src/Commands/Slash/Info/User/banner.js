const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  name: "banner",
  description: "Get a user's profile banner.",
  category: "Info",
  usage: "/info user banner [user]",
  cooldown: 10,
  devOnly: false,

  data: new SlashCommandBuilder()
    .setName("banner")
    .setDescription("Get a user's profile banner.")
    .addUserOption(option =>
      option.setName("user").setDescription("Select a user").setRequired(false)
    ),

  async execute(client, interaction) {
    await interaction.deferReply();

    const user = interaction.options.getUser("user") || interaction.user;
    const fetchedUser = await client.users.fetch(user.id, { force: true });

    if (!fetchedUser.banner) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🎨 User Banner")
            .setColor(0xed4245)
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setDescription(`❌ **${user.tag} does not have a profile banner.**`)
            .setFooter({
              text: `Requested by ${interaction.user.tag}`,
              iconURL: interaction.user.displayAvatarURL(),
            })
            .setTimestamp(),
        ],
      });
    }

    const bannerURL = fetchedUser.bannerURL({ size: 4096, dynamic: true });
    const isAnimated = fetchedUser.banner.startsWith("a_");

    const png = fetchedUser.bannerURL({ size: 4096, extension: "png" });
    const jpg = fetchedUser.bannerURL({ size: 4096, extension: "jpg" });
    const webp = fetchedUser.bannerURL({ size: 4096, extension: "webp" });

    const links = [
      `🖼️ [PNG](${png})`,
      `🖼️ [JPG](${jpg})`,
      `🖼️ [WEBP](${webp})`,
    ].join(" • ");

    const embed = new EmbedBuilder()
      .setTitle("🎨 User Banner")
      .setColor(fetchedUser.hexAccentColor || 0x5865f2)
      .setImage(bannerURL)
      .setDescription(`**${user.tag}**`)
      .addFields(
        {
          name: "Banner Details",
          value: [
            `**Animated:** ${isAnimated ? "Yes" : "No"}`,
            `**Accent Color:** ${fetchedUser.hexAccentColor || "Default"}`,
          ].join("\n"),
          inline: true,
        },
        {
          name: "Direct Links",
          value: links,
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
