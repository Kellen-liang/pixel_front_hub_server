const { DataTypes, Model } = require('sequelize')
const { sequelize } = require('../db')
const { v4: uuidv4 } = require("uuid")

/**
 * @description 创建ORM模型
 */
function createModel({ tableName, ...attributes }) {
  class T extends Model { };
  T.init(attributes, { sequelize, tableName });
  T.sync({ alter: true });
  return T;
}

//使用
//用户实例
const User = createModel({
  tableName: "user",
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  posts: DataTypes.STRING,
  company: DataTypes.STRING,
  main_page_introduction: DataTypes.STRING,
  introduction: DataTypes.STRING,
  user_icon: {
    type: DataTypes.STRING,
    defaultValue: 'http://localhost:3001/api/getImageUrl/default_user_icon.png'
  }
})

//订阅实例
const Subscriber = createModel({
  tableName: "subscriber",
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
  },
  subscribe_user_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },

  be_subscribe_user_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },

})

//文章实例
const Article = createModel({
  tableName: "article",
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  username: {
    type: DataTypes.STRING,
  },
  article_title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  article_cover: DataTypes.STRING,
  article_intro: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  article_content: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  likes: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  comment_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  collects: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  
  tag: DataTypes.STRING,
  category: DataTypes.STRING,
})

//点赞和收藏实例
const LikeCollectCount = createModel({
  tableName: "like_collect_count",
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  collect_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
  },
  like_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
  },
  article_id: {
    type: DataTypes.UUID,
    allowNull: false,
  }
})

//评论实例
const Comment = createModel({
  tableName: "comment",
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  article_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  content: {
    type: DataTypes.STRING,
    allowNull: false,
  },
})

//回复实例
const Reply = createModel({
  tableName: "reply",
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  article_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  comment_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  reply_late_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  content: {
    type: DataTypes.STRING,
    allowNull: false,
  },
})



module.exports = { User, Subscriber, Article, LikeCollectCount, Comment, Reply }