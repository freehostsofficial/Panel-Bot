const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const cleanUrl = (u) => u.replace(/^https?:\/\//, '');

module.exports = {
  name: 'inviteinfo',
  description: 'Get information about a Discord invite',
  category: 'Info',
  usage: '/info server inviteinfo [invite]',
  cooldown: 10,

  data: new SlashCommandBuilder()
    .setName('inviteinfo')
    .setDescription('Get information about a Discord invite')
    .addStringOption(option =>
      option.setName('invite')
        .setDescription('Invite code or link')
        .setRequired(true)
    ),

  async execute(client, interaction) {
    await interaction.deferReply();

    const code = interaction.options.getString('invite')
      .replace(/(https?:\/\/)?(www\.)?discord\.gg\//, '');

    const invite = await client.fetchInvite(code, { force: true });
    const icon = invite.guild?.iconURL({ dynamic: true, size: 1024 });

    const embed = new EmbedBuilder()
      .setTitle('🔗 Invite Info')
      .setColor(0x5865F2)
      .setDescription(`**Code:** \`${invite.code}\``)
      .addFields(
        {
          name: '🏰 Server',
          value: [
            `**Name:** ${invite.guild?.name ?? 'Unknown'}`,
            `**Members:** ${invite.approximateMemberCount ?? 'Unknown'}`,
            `**Online:** ${invite.approximatePresenceCount ?? 'Unknown'}`,
            icon ? `**Icon:** [${cleanUrl(icon)}](${icon})` : '**Icon:** None'
          ].join('\n')
        },
        {
          name: '👤 Invite',
          value: [
            `**Inviter:** ${invite.inviter?.tag ?? 'Unknown'}`,
            `**Expires:** ${invite.maxAge === 0 ? 'Never' : `<t:${Math.floor(invite.expiresTimestamp / 1000)}:R>`}`,
            `**Temporary:** ${invite.temporary ? 'Yes' : 'No'}`
          ].join('\n')
        }
      )
      .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }
};
