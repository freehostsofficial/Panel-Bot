const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  name: "enlargeemoji",
  description: "Enlarge a custom emoji to view it in full size",
  category: "Info",
  usage: "/info server enlargeemoji <emoji>",
  cooldown: 5,
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName("enlargeemoji")
    .setDescription("Enlarge a custom emoji to view it in full size")
    .addStringOption(option =>
      option.setName("emoji")
        .setDescription("The emoji to enlarge (custom emojis only)")
        .setRequired(true)
    ),

  async execute(client, interaction) {
    await interaction.deferReply();

    const emojiInput = interaction.options.getString("emoji");
    
    // Regex to match custom emoji format <:name:id> or <a:name:id>
    const emojiRegex = /^<(a?):([^:]+):(\d+)>$/;
    const match = emojiInput.match(emojiRegex);
    
    let emojiUrl, emojiName, isAnimated;
    
    if (match) {
      // Emoji is in Discord format <a:name:id> or <:name:id>
      isAnimated = Boolean(match[1]);
      emojiName = match[2];
      const emojiId = match[3];
      emojiUrl = `https://cdn.discordapp.com/emojis/${emojiId}.${isAnimated ? 'gif' : 'png'}?size=4096&quality=lossless`;
    } else {
      // Try to parse as just an emoji ID
      const idMatch = emojiInput.match(/^\d+$/);
      if (idMatch) {
        // Try to determine if it's animated by checking the guild emojis
        const guild = interaction.guild;
        const emoji = guild.emojis.cache.get(emojiInput);
        
        if (emoji) {
          emojiUrl = emoji.url;
          emojiName = emoji.name;
          isAnimated = emoji.animated;
        } else {
          // Default to PNG, but this might fail
          emojiUrl = `https://cdn.discordapp.com/emojis/${emojiInput}.png?size=4096&quality=lossless`;
          emojiName = "unknown";
          isAnimated = false;
        }
      } else {
        // Try to find the emoji in the guild by name
        const guild = interaction.guild;
        const emoji = guild.emojis.cache.find(e => e.name === emojiInput);
        
        if (emoji) {
          emojiUrl = emoji.url;
          emojiName = emoji.name;
          isAnimated = emoji.animated;
        } else {
          return interaction.editReply({
            content: "❌ Please provide a valid custom emoji. I can accept: \n• Emoji picker selection\n• Emoji ID\n• Emoji name (if in this server)",
          });
        }
      }
    }

    const embed = new EmbedBuilder()
      .setTitle(`🔍 Enlarged Emoji`)
      .setColor(interaction.guild?.members.me?.displayHexColor || 0x5865F2)
      .setDescription(`**Name:** ${emojiName}${isAnimated ? "\n**Type:** Animated" : ""}`)
      .setImage(emojiUrl)
      .addFields(
        {
          name: "🔗 Direct Link",
          value: `[\`Open Image\`](${emojiUrl})`,
          inline: true
        },
        {
          name: "📥 Download",
          value: `[\`Download ${isAnimated ? 'GIF' : 'PNG'}\`](${emojiUrl})`,
          inline: true
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
