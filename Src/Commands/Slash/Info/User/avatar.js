const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  name: "avatar",
  description: "Get a user's avatar in high quality.",
  category: "Info",
  usage: "/info user avatar [user] [type]",
  cooldown: 10,
  devOnly: false,

  data: new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("Get a user's avatar in high quality.")
    .addUserOption(option =>
      option.setName("user").setDescription("Select a user").setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName("type")
        .setDescription("Avatar type")
        .setRequired(false)
        .addChoices(
          { name: "Global Avatar", value: "global" },
          { name: "Server Avatar", value: "guild" }
        )
    ),

  async execute(client, interaction) {
    await interaction.deferReply();

    const target = interaction.options.getUser("user") || interaction.user;
    const type = interaction.options.getString("type") || "global";
    const member = interaction.guild?.members.cache.get(target.id);

    let avatarURL;
    let avatarType;

    if (type === "guild" && member?.avatar) {
      avatarURL = member.displayAvatarURL({ dynamic: true, size: 4096 });
      avatarType = "Server Avatar";
    } else {
      avatarURL = target.displayAvatarURL({ dynamic: true, size: 4096 });
      avatarType = "Global Avatar";
    }

    if (!avatarURL) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🖼️ Avatar")
            .setColor(0xed4245)
            .setDescription(`❌ **${target.tag} does not have a custom avatar.**`)
            .setFooter({
              text: `Requested by ${interaction.user.tag}`,
              iconURL: interaction.user.displayAvatarURL(),
            })
            .setTimestamp(),
        ],
      });
    }

    const isAnimated = avatarURL.endsWith(".gif");

    const sizes = [256, 512, 1024, 2048, 4096];
    const links = sizes
      .map(size => {
        const url = avatarURL.replace("4096", size);
        return `🖼️ [${size}](${url})`;
      })
      .join(" • ");

    const embed = new EmbedBuilder()
      .setTitle(`🖼️ ${target.username}'s ${avatarType}`)
      .setColor(0x5865f2)
      .setImage(avatarURL)
      .setDescription(`**${target.tag}** (<@${target.id}>)`)
      .addFields(
        {
          name: "Avatar Details",
          value: [
            `**Type:** ${avatarType}`,
            `**Animated:** ${isAnimated ? "Yes" : "No"}`,
            `**Account Created:** <t:${Math.floor(
              target.createdTimestamp / 1000
            )}:R>`,
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
