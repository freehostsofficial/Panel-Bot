const { SlashCommandBuilder, EmbedBuilder, Colors } = require('discord.js');

module.exports = {
  name: 'role',
  description: 'Display detailed information about a server role',
  category: 'Info',
  usage: '/info server role [role]',
  cooldown: 10,
  devOnly: false,
  guildOnly: true,
  
  voiceOnly: false,
  nsfwOnly: false,
  toggleOffCmd: false,
  maintenanceCmd: false,

  data: new SlashCommandBuilder()
    .setName('serverrole')
    .setDescription('Display detailed information about a server role')
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('The role to inspect')
        .setRequired(false)
    ),

  async execute(client, interaction) {
    await interaction.deferReply();

    const role = interaction.options.getRole('role') || interaction.guild.roles.highest;
    const guild = interaction.guild;

    // Fetch members to count role members
    await guild.members.fetch();
    const roleMembers = guild.members.cache.filter(m => m.roles.cache.has(role.id));

    const permissions = role.permissions.toArray();
    const topPermissions = permissions.slice(0, 5).map(p => `• ${p}`).join('\n') || 'None';

    const embed = new EmbedBuilder()
      .setTitle(`🎭 Role: ${role.name}`)
      .setColor(role.color || Colors.Blurple)
      .setThumbnail(role.iconURL({ size: 256 }) || null)
      .addFields(
        {
          name: '📊 Role Statistics',
          value: `**ID:** \`${role.id}\`\n**Members:** ${roleMembers.size}\n**Position:** ${role.position}/${guild.roles.cache.size}`,
          inline: true
        },
        {
          name: '⚙️ Role Settings',
          value: `**Color:** ${role.hexColor}\n**Hoisted:** ${role.hoist ? 'Yes' : 'No'}\n**Mentionable:** ${role.mentionable ? 'Yes' : 'No'}\n**Managed:** ${role.managed ? 'Yes 🤖' : 'No'}`,
          inline: true
        },
        {
          name: '🔑 Key Permissions',
          value: topPermissions,
          inline: false
        },
        {
          name: '📅 Role Created',
          value: `<t:${Math.floor(role.createdTimestamp / 1000)}:F> (<t:${Math.floor(role.createdTimestamp / 1000)}:R>)`,
          inline: true
        }
      )
      .setFooter({
        text: `Role ID: ${role.id} • Requested by ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL({ dynamic: true })
      })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }
};
