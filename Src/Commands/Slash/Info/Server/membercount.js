const { SlashCommandBuilder, EmbedBuilder, Colors } = require('discord.js');

module.exports = {
  name: 'membercount',
  description: 'Display server member count breakdown',
  category: 'Info',
  usage: '/info server membercount',
  cooldown: 10,
  devOnly: false,
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName('membercount')
    .setDescription('Display server member count breakdown'),

  async execute(client, interaction) {
    await interaction.deferReply();

    const guild = interaction.guild;
    const members = await guild.members.fetch();

    const total = guild.memberCount;
    const bots = members.filter(m => m.user.bot).size;
    const humans = total - bots;

    const online = members.filter(m => m.presence?.status === 'online').size;
    const idle = members.filter(m => m.presence?.status === 'idle').size;
    const dnd = members.filter(m => m.presence?.status === 'dnd').size;
    const offline = members.filter(m => !m.presence || m.presence.status === 'offline').size;

    const percOnline = ((online / total) * 100).toFixed(1);
    const percBots = ((bots / total) * 100).toFixed(1);

    const embed = new EmbedBuilder()
      .setTitle('👥 **Member Count**')
      .setColor(guild.members.me.displayHexColor || Colors.Blurple)
      .setThumbnail(guild.iconURL({ size: 256 }))
      .setDescription(`**${guild.name}** member statistics`)
      .addFields(
        { name: '📊 Total Members', value: `**${total.toLocaleString()}** members`, inline: true },
        { name: '🤖 Bots & Humans', value: `Bots: **${bots.toLocaleString()}** (${percBots}%)\nHumans: **${humans.toLocaleString()}** (${(100 - percBots).toFixed(1)}%)`, inline: true },
        { name: '📈 Presence', value: `🟢 Online: ${online} (${percOnline}%)\n🟡 Idle: ${idle}\n🔴 DND: ${dnd}\n⚫ Offline: ${offline}`, inline: false },
        { name: '🎯 Distribution', value: `Online Rate: ${percOnline}%\nBot Ratio: ${percBots}%\nActive Users: ${(online + idle + dnd).toLocaleString()}`, inline: true }
      )
      .setFooter({ text: `Server ID: ${guild.id} • Updated in real-time`, iconURL: guild.iconURL() })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }
};
