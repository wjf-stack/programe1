import { DataTypes } from 'sequelize'
import { sequelize } from '../config/database.js'

export const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
  password: { type: DataTypes.STRING(255), allowNull: false },
  avatar: { type: DataTypes.STRING(500), defaultValue: null }
})

export const Tag = sequelize.define('Tag', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  userId: { type: DataTypes.INTEGER, allowNull: false }
})

export const Note = sequelize.define('Note', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING(500), defaultValue: '无标题' },
  content: { type: DataTypes.TEXT, defaultValue: '' },
  type: { type: DataTypes.ENUM('quick', 'rich', 'clip', 'expand'), defaultValue: 'quick' },
  source: { type: DataTypes.STRING(1000), defaultValue: null },
  userId: { type: DataTypes.INTEGER, allowNull: false }
})

export const NoteTag = sequelize.define('NoteTag', {
  noteId: { type: DataTypes.INTEGER },
  tagId: { type: DataTypes.INTEGER }
}, { timestamps: false })

export const Relation = sequelize.define('Relation', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  sourceId: { type: DataTypes.INTEGER, allowNull: false },
  targetId: { type: DataTypes.INTEGER, allowNull: false },
  strength: { type: DataTypes.INTEGER, defaultValue: 50 },
  userId: { type: DataTypes.INTEGER, allowNull: false }
})

// 关联关系
Note.belongsToMany(Tag, { through: NoteTag, foreignKey: 'noteId' })
Tag.belongsToMany(Note, { through: NoteTag, foreignKey: 'tagId' })
User.hasMany(Note, { foreignKey: 'userId' })
Note.belongsTo(User, { foreignKey: 'userId' })
User.hasMany(Tag, { foreignKey: 'userId' })
Tag.belongsTo(User, { foreignKey: 'userId' })

export default { User, Tag, Note, NoteTag, Relation }
