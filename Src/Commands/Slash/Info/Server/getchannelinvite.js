const {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
  Colors
} = require('discord.js');

module.exports = {
  name: 'getchannelinvite',
  description: 'Create an invite for a channel',
  category: 'Info',
  usage: '/info server getchannelinvite [channel]',
  cooldown: 10,
  devOnly: false,
  guildOnly: true,
  requiredRole: false,
  voiceOnly: false,
  nsfwOnly: false,
  toggleOffCmd: false,
  maintenanceCmd: false,

  data: new SlashCommandBuilder()
    .setName('getchannelinvite')
    .setDescription('Create an invite for a channel')
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('The channel to create an invite for')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice)
        .setRequired(false)
    ),

  async execute(client, interaction) {
    await interaction.deferReply({ ephemeral: true });

    const channel =
      interaction.options.getChannel('channel') || interaction.channel;

    if (
      !channel
        .permissionsFor(interaction.guild.members.me)
        ?.has(PermissionFlagsBits.CreateInstantInvite)
    ) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('❌ Permission Denied')
            .setColor(Colors.Red)
            .setDescription(
              'I need the **Create Invite** permission in this channel.'
            )
            .setTimestamp()
        ]
      });
    }

    try {
      const invite = await channel.createInvite({
        maxAge: 86400,
        maxUses: 10,
        reason: `Created by ${interaction.user.tag}`
      });

      const inviteUrl = `https://discord.gg/${invite.code}`;
      const inviteLabel = `discord.gg/${invite.code}`;

      const embed = new EmbedBuilder()
        .setTitle('🔗 Channel Invite Created')
        .setColor(Colors.Blurple)
        .setDescription(`Invite created for ${channel}`)
        .addFields(
          {
            name: '📝 Invite Info',
            value: [
              `**Code:** \`${invite.code}\``,
              `**Expires:** <t:${Math.floor(
                (Date.now() + invite.maxAge * 1000) / 1000
              )}:R>`,
              `**Max Uses:** ${invite.maxUses}`
            ].join('\n'),
            inline: true
          },
          {
            name: '📊 Details',
            value: [
              `**Creator:** ${interaction.user.tag}`,
              `**Channel:** ${channel.name}`,
              `**Type:** ${
                channel.type === ChannelType.GuildText ? 'Text' : 'Voice'
              }`
            ].join('\n'),
            inline: true
          },
          {
            name: '🔗 Invite Link',
            value: `[${inviteLabel}](${inviteUrl})`,
            inline: false
          }
        )
        .setFooter({
          text: `Server: ${interaction.guild.name} • Requested by ${interaction.user.tag}`,
          iconURL: interaction.guild.iconURL({ dynamic: true })
        })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('Invite creation failed:', err);
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('❌ Invite Creation Failed')
            .setColor(Colors.Red)
            .setDescription(
              'Could not create an invite. Ensure I have permission and try again.'
            )
            .setTimestamp()
        ]
      });
    }
  }
};
