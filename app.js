const express = require('express')
const request = require('request')
const bodyParser = require("body-parser");
const cors = require("cors");
const { Op } = require("sequelize");
const bcrypt = require('bcryptjs');
const jwt = require("jsonwebtoken")
const cookieParser = require('cookie-parser')
const multer = require('multer')
const path = require('path')
const _ = require('lodash');

//实例对象
const { User, Article, LikeCollectCount, Comment, Reply } = require('./entity/entity.js')

//创建应用对象
const PORT = 3001
const app = express()

// const corsOptions = {
//   origin: "*"
// }
// app.use(cors(corsOptions));
app.use(express.json())
// content-type：application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));
// content-type：application/json
app.use(bodyParser.json());
app.use(cookieParser());


app.all('*', function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "http://127.0.0.1:3002");
  res.header("Access-Control-Allow-Headers", "Content-Type,Content-Length, Authorization, Accept,X-Requested-With");
  res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header("X-Powered-By", ' 3.2.1')
  next();
});

//文件上传
//①创建存储空间
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads");
  },
  filename: function (req, file, cb) {
    //解决中文乱码问题
    const originalName = file.originalname
    const encodedName = Buffer.from(originalName, 'binary').toString()
    cb(null, Date.now() + encodedName);
  },
});
const upload = multer({ storage });
//②上传文件接口
app.post("/api/upload", upload.single("file"), function (req, res) {
  const file = req.file;
  res.status(200).json({
    filename: file.filename,
    path: `http://localhost:3001/api/getImageUrl/${file.filename}`
  })
});

//访问文件
app.get('/api/getImageUrl/:filename', (req, res) => {
  const { filename } = req.params
  const imagePath = path.join(__dirname, 'uploads', filename)
  res.sendFile(imagePath)
})

app.post('/api/user/login', async (req, res) => {
  const { username, password } = req.body
  console.log('form ->', username, password);
  const user = await User.findOne({ where: { username: username } })
  if (user === null) return res.status(200).json({ status: 0, errmsg: '用户不存在', data: '' })
  // 密码hash比对
  const isTruePassword = bcrypt.compareSync(password, user.password)
  if (!isTruePassword) return res.status(200).json({ status: 0, errmsg: '密码错误', data: '' })

  //token设置
  const token = jwt.sign({ id: user.id, username: username, user_icon: user.user_icon }, "jwtkey")
  const { ...other } = user.dataValues
  delete other.password

  const likes = await LikeCollectCount.findAll({
    where: {
      [Op.and]: [
        { user_id: user.id },
        {
          like_id: {
            [Op.not]: null
          }
        }
      ]
    }
  }) || []

  const collects = await LikeCollectCount.findAll({
    where: {
      [Op.and]: [
        { user_id: user.id },
        {
          collect_id: {
            [Op.not]: null
          }
        }
      ]
    }
  }) || []

  res
    .cookie("access_token", token, {
      httpOnly: true,
    })
    .status(200)
    .json({ status: 1, errmsg: '', data: { ...other, likeCount: likes.length, collectCount: collects.length } })
})

app.post('/api/user/logout', async (req, res) => {
  res.clearCookie("access_token", {
    sameSite: "none",
    secure: true
  }).status(200).json({ status: 1, errmsg: '', data: '退出登录成功' })
})

app.post('/api/user/register', async (req, res) => {
  const { username, password, email } = req.body

  //密码转hash自动加盐
  const salt = bcrypt.genSaltSync(10);
  const hashPassword = bcrypt.hashSync(password, salt);

  const [user, created] = await User.findOrCreate({
    where: {
      [Op.or]: [
        { username: username },
        { email: email },
      ]
    },
    defaults: {
      username: username,
      password: hashPassword,
      email: email
    }
  })
  if (created) {
    return res.status(200).json({ status: 1, errmsg: '', data: '注册成功' })
  }
  else {
    return res.status(200).json({ status: 0, errmsg: '该用户名或者邮箱已被注册', data: '' })
  }
})

app.get('/api/weatherInfo', async (req, res) => {
  const option = {
    url: 'https://www.yiketianqi.com/free/day',
    qs: {
      appid: '62565573',
      appsecret: '6rCj71Gy',
      unescape: '1',
      vue: '1'
    }
  }
  request.get(option, (error, response, body) => {
    if (error) {
      console.error('Error occurred: ', error);
      return;
    }
    if (response?.body?.errmsg) {
      return res.status(200).json({ status: 0, errmsg: response.body.errmsg, data: '' })
    }
    return res.status(200).json({ status: 1, errmsg: '', data: JSON.parse(response.body) })
  });
})


//创建文章
app.post('/api/article/create', async (req, res) => {
  //获取token
  const token = req.cookies.access_token;
  if (!token) return res.status(200).json({ status: 0, errmsg: '请登录系统', data: '' })

  const {
    article_title,
    article_intro,
    article_cover,
    article_content,
    category,
    tag,
  } = req.body;

  jwt.verify(token, 'jwtkey', async (err, userInfo) => {
    if (err) return res.status(200).json({ status: 0, errmsg: err, data: '' })

    const isExist = await Article.findOne({ where: { article_title: article_title } })
    if (isExist) return res.status(200).json({ status: 0, errmsg: '该标题已被使用', data: '' })

    try {
      await Article.create({
        article_title,
        article_intro,
        article_cover,
        article_content,
        category,
        tag,
        user_id: userInfo.id,
        username: userInfo.username
      })
      res.status(200).json({ status: 1, errmsg: '', data: '创建成功' })
    } catch (error) {
      res.status(200).json({ status: 0, errmsg: error?.toString() || error, data: '' })
    }
  })

})

//查询文章
app.get('/api/article/getArticle', async (req, res) => {
  const { tag = '', category = '', article_title = '' } = req.query
  console.log('tag', tag);
  console.log('category', category);
  console.log('article_title', article_title);

  //获取token
  const token = req.cookies.access_token;
  let user_id, username
  jwt.verify(token, 'jwtkey', function (err, userInfo) {
    user_id = userInfo.id
    username = userInfo.username,
    user_icon = userInfo.user_icon
  })

  //分页:
  const page = parseInt(req.query?.page) || 1 //当亲页
  const pageSize = parseInt(req.query?.pageSize) || 10 //每页显示数
  const offset = (page - 1) * pageSize //起始索引
  const setting = {
    order: [['updatedAt', 'DESC']],
    offset: offset,
    limit: pageSize,
  }
  let articels = []
  let total = 0
  let searchTypes = []

  if (article_title) searchTypes.push(1)
  if (category) searchTypes.push(2)
  if (tag) searchTypes.push(3)

  // console.log(searchTypes);

  switch (searchTypes.join()) {
    case '1':
      articels =
        await Article.findAll({
          ...setting,
          where: {
            article_title: {
              [Op.like]: `%${article_title}%`
            }
          }
        })
      total = await Article.count({
        where: {
          article_title: {
            [Op.like]: `%${article_title}%`
          }
        }
      })
      console.log(1);
      break
    case '2':
      articels =
        await Article.findAll({
          ...setting,
          where: { category: category }
        });
      total = await Article.count({ where: { category: category } })
      console.log(2);
      break
    case '3':
      articels =
        await Article.findAll({
          ...setting,
          where: {
            tag: {
              [Op.like]: `%${tag}%`
            }
          }
        })
      total = await Article.count({
        where: {
          tag: {
            [Op.like]: `%${tag}%`
          }
        }
      })
      console.log(3);
      break
    case '1,2':
      articels =
        await Article.findAll({
          ...setting,
          where: {
            [Op.and]: [
              { article_title: { [Op.like]: `%${article_title}%` } },
              { category: { [Op.eq]: category } },
            ],
          }
        })
      total = await Article.count({
        where: {
          [Op.and]: [
            { article_title: { [Op.like]: `%${article_title}%` } },
            { category: { [Op.eq]: category } },
          ],
        }
      })
      console.log(12);
      break
    case '1,3':
      articels =
        await Article.findAll({
          ...setting,
          where: {
            [Op.and]: [
              { article_title: { [Op.like]: `%${article_title}%` } },
              { tag: { [Op.like]: `%${tag}%` } },
            ],
          }
        })
      total = await Article.count({
        where: {
          [Op.and]: [
            { article_title: { [Op.like]: `%${article_title}%` } },
            { tag: { [Op.like]: `%${tag}%` } },
          ],
        }
      })
      console.log(13);
      break
    case '2,3':
      articels =
        await Article.findAll({
          ...setting,
          where: {
            [Op.and]: [
              { category: { [Op.eq]: category } },
              { tag: { [Op.like]: `%${tag}%` } },
            ],
          }
        })
      total = await Article.count({
        where: {
          [Op.and]: [
            { category: { [Op.eq]: category } },
            { tag: { [Op.like]: `%${tag}%` } },
          ],
        }
      })
      console.log(23);
      break
    case '1,2,3':
      articels =
        await Article.findAll({
          ...setting,
          where: {
            [Op.and]: [
              { article_title: { [Op.like]: `%${article_title}%` } },
              { category: { [Op.eq]: category } },
              { tag: { [Op.like]: `%${tag}%` } },
            ],
          }
        })
      total = await Article.count({
        where: {
          [Op.and]: [
            { article_title: { [Op.like]: `%${article_title}%` } },
            { category: { [Op.eq]: category } },
            { tag: { [Op.like]: `%${tag}%` } },
          ],
        }
      })
      console.log(23);
      break
    default:
      articels =
        await Article.findAll({ ...setting })
      total = await Article.count()
      console.log(0);
      break
  }

  if (articels === null) {
    return res.status(200).json({ status: 0, errmsg: '服务器出错', data: '' })
  }

  // console.log('articels', articels);


  const handleList = await Promise.all(articels.map(async item => {
    const count1 = await Comment.count({ where: { article_id: item.id } }) || 0
    const count2 = await Reply.count({ where: { article_id: item.id } }) || 0
    item.comment_count = count1 + count2
    await item.save()
    return item.dataValues
  }))
  const articelList = await Promise.all(handleList.map(async item => {
    const like = await LikeCollectCount.findOne({
      where: {
        [Op.and]: [
          { user_id: user_id },
          { article_id: item.id },
          {
            like_id: {
              [Op.not]: null
            }
          }
        ]
      }
    })
    const collect = await LikeCollectCount.findOne({
      where: {
        [Op.and]: [
          { user_id: user_id },
          { article_id: item.id },
          {
            collect_id: {
              [Op.not]: null
            }
          }
        ]
      }
    })

    const user = await User.findByPk(item.user_id)
    return {
      ...item,
      user_icon: user.user_icon,
      is_like: like ? true : false,
      is_collect: collect ? true : false
    }

  }))


  return res.status(200).json({ status: 1, errmsg: '', data: articelList, total, page, pageSize })
})

//查询指定文章
app.get('/api/article/getArticle_id', async (req, res) => {
  const { id, edit = false } = req.query

  //获取token
  const token = req.cookies.access_token;
  let user_id, username
  jwt.verify(token, 'jwtkey', function (err, userInfo) {
    user_id = userInfo.id
    username = userInfo.username
  })

  const article = await Article.findByPk(id)

  if (article === null) {
    return res.status(200).json({ status: 0, errmsg: '查询不到改文章', data: '' })
  }

  //点击查看时，点击数+1
  !edit && await Article.increment({ count: 1 }, { where: { id: id } })
  //  article.count = article.count + 1
  // await article.save()


  const handleArticle = article.dataValues


  const like = await LikeCollectCount.findOne({
    where: {
      [Op.and]: [
        { user_id: user_id },
        { article_id: handleArticle.id },
        {
          like_id: {
            [Op.not]: null
          }
        }
      ]
    }
  })
  const collect = await LikeCollectCount.findOne({
    where: {
      [Op.and]: [
        { user_id: user_id },
        { article_id: handleArticle.id },
        {
          collect_id: {
            [Op.not]: null
          }
        }
      ]
    }
  })

  const user = await User.findByPk(handleArticle.user_id)

  return res.status(200).json({
    status: 1,
    errmsg: '',
    data: {
      ...handleArticle,
      user_icon: user.user_icon,
      isMine: user.id === user_id ? true : false,
      is_like: like ? true : false,
      is_collect: collect ? true : false
    },
  })
})

//查询指定用户文章列表
app.get('/api/article/getArticle_user_id', async (req, res) => {
  const { id } = req.query
  const articles = await Article.findAll({
    order: [['updatedAt', 'DESC']],
    where : {
      user_id : id
    }
  })
  const user = await User.findByPk(id)

  const tempArticles = articles.map(item => item.dataValues)
  const data = await Promise.all(tempArticles.map(async item => {
    const like = await LikeCollectCount.findOne({
      where: {
        [Op.and]: [
          { user_id: item.user_id },
          { article_id: item.id },
          {
            like_id: {
              [Op.not]: null
            }
          }
        ]
      }
    })
    return {
      ...item,
      user_icon: user.user_icon,
      is_like: like ? true : false,
    }
  }))

  return res.status(200).json({ status: 1, errmsg: '', data: data})
})

//删除指定文章
app.post('/api/article/deleteArticle', async (req, res) => {
  const { id } = req.body
  const article = await Article.findByPk(id)
  console.log('article---', article);
  if (article === null) return res.status(200).json({ status: 0, errmsg: `删除失败，未找到id为${id}的文章`, data: '' })
  await article.destroy()
  const LikeAndCollect = await LikeCollectCount.findAll({ where: { article_id: id } })
  await Promise.all(LikeAndCollect.map(async item => {
    await item.destroy()
  }))
  return res.status(200).json({ status: 1, errmsg: '', data: '删除成功' })
})

//更新文章
app.post('/api/article/updataArticle', async (req, res) => {
  const {
    id,
    article_title,
    article_intro,
    article_cover,
    article_content,
    category,
    tag,
  } = req.body

  const article = await Article.findByPk(id)
  article.set({
    article_title,
    article_intro,
    article_cover,
    article_content,
    category,
    tag
  })
  const updataArticle = await article.save()
  if (!updataArticle) return res.status(200).json({ status: 0, errmsg: '修改失败，服务器出错', data: '' })
  return res.status(200).json({ status: 1, errmsg: '', data: '修改成功' })
})

//点赞/收藏
app.post('/api/likeCollectCount/operate', async (req, res) => {
  //operate_type : like,collect 
  //operate_code : 1点赞/收藏,0取消点赞/收藏 
  const { article_id, operate_type, operate_code } = req.body
  let value


  //获取token
  const token = req.cookies.access_token;
  if (!token) return res.status(200).json({ status: 0, errmsg: '请登录系统', data: '' })
  jwt.verify(token, 'jwtkey', async (err, userInfo) => {
    if (err) return res.status(200).json({ status: 0, errmsg: err, data: '' })

    if (operate_type === 'like') {
      value = {
        user_id: userInfo.id,
        username: userInfo.username,
        collect_id: null,
        article_id
      }
    }
    else {
      value = {
        user_id: userInfo.id,
        username: userInfo.username,
        like_id: null,
        article_id
      }
    }

    const handleLike = async (operate_type, operate_code) => {
      if (!operate_code) {
        const like = await LikeCollectCount.findOne({
          where: {
            [Op.and]: [
              { user_id: userInfo.id },
              { article_id },
              {
                like_id: {
                  [Op.not]: null
                }
              }
            ]
          }
        })
        if (like === null) return res.status(200).json({ status: 0, errmsg: '该数据没有被点赞，无法取消点赞', data: '' })
        await like.destroy()
        handleArticle(operate_type, operate_code)
        return res.status(200).json({ status: 1, errmsg: '', data: '取消点赞成功' })
      }
      else {
        const [like, created] = await LikeCollectCount.findOrCreate({
          where: {
            [Op.and]: [
              { user_id: userInfo.id },
              { article_id },
              {
                like_id: {
                  [Op.not]: null
                }
              }
            ]
          },
          defaults: value
        })
        if (created) {
          handleArticle(operate_type, operate_code)
          return res.status(200).json({ status: 1, errmsg: '', data: '点赞成功' })
        }
        else {
          return res.status(200).json({ status: 0, errmsg: '该用户已点赞该文章，不能重复点赞', data: '' })
        }
      }
    }
    const handleCollect = async (operate_type, operate_code) => {
      if (!operate_code) {
        const collect = await LikeCollectCount.findOne({
          where: {
            [Op.and]: [
              { user_id: userInfo.id },
              { article_id },
              {
                collect_id: {
                  [Op.not]: null
                }
              }
            ]
          }
        })
        if (collect === null) return res.status(200).json({ status: 0, errmsg: '该数据没有被收藏，无法取消收藏', data: '' })
        await collect.destroy()
        handleArticle(operate_type, operate_code)
        return res.status(200).json({ status: 1, errmsg: '', data: '取消收藏成功' })
      } else {
        const [collect, created] = await LikeCollectCount.findOrCreate({
          where: {
            [Op.and]: [
              { user_id: userInfo.id },
              { article_id },
              {
                collect_id: {
                  [Op.not]: null
                }
              }
            ]
          },
          defaults: value
        })
        if (created) {
          handleArticle(operate_type, operate_code)
          return res.status(200).json({ status: 1, errmsg: '', data: '收藏成功' })
        }
        else {
          return res.status(200).json({ status: 0, errmsg: '该用户已收藏该文章，不能重复收藏', data: '' })
        }
      }
    }
    const handleArticle = async (type, code) => {
      const articel = await Article.findByPk(article_id)
      let attribute = type === 'like' ? 'likes' : 'collects'
      articel[attribute] = code ? articel[attribute] + 1 : articel[attribute] - 1
      await articel.save()
    }

    switch (operate_type) {
      case 'like': handleLike('like', operate_code)
        break
      case 'collect': handleCollect('collect', operate_code)
        break
      default:
        break
    }

  })

})

//查询点赞文章列表
app.get('/api/likeCollectCount/searchLikeList', async (req, res) => {
  const { id } = req.query
  console.log('id---',id);
  const dataList = await LikeCollectCount.findAll({
    order: [['updatedAt', 'DESC']],
    where: {
      [Op.and]: [
        { user_id: id },
        {
          like_id: {
            [Op.not]: null
          }
        }
      ]
    }
  }) || []
  if (dataList.length === 0) return res.status(200).json({ status: 1, errmsg: '', data: [] })
  const handleList = dataList.map(item => item.dataValues)

  const newDataList = await Promise.all(handleList.map(async item => {
    const article = await Article.findByPk(item.article_id)
    const user = await User.findByPk(id)
    return {
      ...article.dataValues,
      user_icon: user.user_icon,
      is_like: item.like_id ? true : false,
    }

  }))

  return res.status(200).json({
    status: 1,
    errmsg: '',
    data: newDataList
  })

})

//查询收藏文章列表
app.get('/api/likeCollectCount/searchCollectList', async (req, res) => {
  const { id } = req.query
  const dataList = await LikeCollectCount.findAll({
    order: [['updatedAt', 'DESC']],
    where: {
      [Op.and]: [
        { user_id: id },
        {
          collect_id: {
            [Op.not]: null
          }
        }
      ]
    }
  }) || []
  if (dataList.length === 0) return res.status(200).json({ status: 1, errmsg: '', data: [] })
  const handleList = dataList.map(item => item.dataValues)

  const newDataList = await Promise.all(handleList.map(async item => {
    const article = await Article.findByPk(item.article_id)
    const user = await User.findByPk(id)
    return {
      ...article.dataValues,
      user_icon: user.user_icon,
      is_like: item.like_id ? true : false,
    }

  }))

  return res.status(200).json({
    status: 1,
    errmsg: '',
    data: newDataList
  })

})

//创建一条评论
app.post('/api/comment/create', async (req, res) => {
  const { article_id, content } = req.body
  //获取token
  const token = req.cookies.access_token;
  if (!token) return res.status(200).json({ status: 0, errmsg: '请登录系统', data: '' })
  let user_id

  jwt.verify(token, 'jwtkey', async (err, userInfo) => {
    if (err) return res.status(200).json({ status: 0, errmsg: err, data: '' })
    console.log('userInfo', userInfo);
    user_id = userInfo.id
  })

  const comment = await Comment.create({
    article_id,
    content,
    user_id,
  })

  if (comment === null) return res.status(200).json({ status: 0, errmsg: '评论失败', data: '' })
  else return res.status(200).json({ status: 1, errmsg: '', data: '评论成功' })
})

//创建一条回复
app.post('/api/comment/createReply', async (req, res) => {
  const { article_id, comment_id, reply_late_id, content } = req.body
  //获取token
  const token = req.cookies.access_token;
  if (!token) return res.status(200).json({ status: 0, errmsg: '请登录系统', data: '' })
  let user_id

  jwt.verify(token, 'jwtkey', async (err, userInfo) => {
    if (err) return res.status(200).json({ status: 0, errmsg: err, data: '' })
    user_id = userInfo.id
  })

  const reply = await Reply.create({
    article_id,
    comment_id,
    user_id,
    reply_late_id,
    content,
  })

  if (reply === null) return res.status(200).json({ status: 0, errmsg: '回复失败', data: '' })
  else return res.status(200).json({ status: 1, errmsg: '', data: '回复成功' })
})

//获取评论列表
app.get('/api/comment/list', async (req, res) => {
  const { article_id } = req.query
  //获取token
  const token = req.cookies.access_token;
  if (!token) return res.status(200).json({ status: 0, errmsg: '请登录系统', data: '' })
  let user_id, username

  jwt.verify(token, 'jwtkey', async (err, userInfo) => {
    if (err) return res.status(200).json({ status: 0, errmsg: err, data: '' })
    user_id = userInfo.id
    username = userInfo.username
  })

  const commentList = await Comment.findAll({
    order: [['updatedAt', 'DESC']],
    where: {
      article_id
    }
  })

  const tempList = commentList.map(item => item.dataValues)
  const data = await Promise.all(tempList.map(async item => {
    const user = await User.findByPk(item.user_id)

    const replyList = await Reply.findAll({
      where: {
        article_id: item.article_id,
        comment_id: item.id,
      }
    }) || []



    let replyListNew
    if (replyList.length === 0) {
      replyListNew = []
    }
    else {
      const tempList = replyList.map(item => item.dataValues)
      replyListNew = await Promise.all(tempList.map(async reply => {
        const user = await User.findByPk(reply.user_id)
        const reply_late = await User.findByPk(reply.reply_late_id)
        return {
          ...reply,
          username: user.username,
          user_icon: user.user_icon,
          reply_late: reply_late.username,
          isMine: reply.user_id === user_id ? true : false,
        }
      }))
    }



    return {
      ...item,
      user_icon: user.user_icon,
      username: user.username,
      isMine: item.user_id === user_id ? true : false,
      reply_comment_list: replyListNew
    }
  }))

  return res.status(200).json({ status: 1, errmsg: '', data: data })
})

//删除评论
app.post('/api/comment/deleteComment', async (req, res) => {
  const { id } = req.body
  const comment = await Comment.findByPk(id)
  const replys = await Reply.findAll({ where: { comment_id: id } })
  const all = await Promise.all(replys.map(async item => {
    await item.destroy()
  }))
  if (comment === null) return res.status(200).json({ status: 0, errmsg: `删除失败，未找到id为${id}的评论`, data: '' })
  await comment.destroy()
  return res.status(200).json({ status: 1, errmsg: '', data: '删除成功' })
})

//删除回复
app.post('/api/comment/deleteReply', async (req, res) => {
  const { id } = req.body
  const reply = await Reply.findByPk(id)
  if (reply === null) return res.status(200).json({ status: 0, errmsg: `删除失败，未找到id为${id}的回复`, data: '' })
  await reply.destroy()
  return res.status(200).json({ status: 1, errmsg: '', data: '删除成功' })
})

//message点赞列表
app.get('/api/message/likeList', async (req, res) => {
  //获取token
  const token = req.cookies.access_token;
  if (!token) return res.status(200).json({ status: 0, errmsg: '请登录系统', data: '' })
  let user_id

  jwt.verify(token, 'jwtkey', async (err, userInfo) => {
    if (err) return res.status(200).json({ status: 0, errmsg: err, data: '' })
    user_id = userInfo.id
  })


  const articles = await Article.findAll({ where: { user_id: user_id } })
  const tempArticles = articles.map(item => item.dataValues)
  const tempData = await Promise.all(tempArticles.map(async item => {
    const likes = await LikeCollectCount.findOne({
      where: {
        [Op.and]: [
          { article_id: item.id },
          {
            like_id: {
              [Op.not]: null
            }
          }
        ]
      }
    })
    if (likes === null) {
      return {
        ...item
      }
    }
    else {
      return {
        ...item,
        likesUserId: likes.user_id,
        likesUsername: likes.username,
        createDate: likes.updatedAt
      }
    }
  }))

  let data
  data = tempData.filter(item => item.likesUserId)
  data = await Promise.all(data.map(async item => {
    const user = await User.findByPk(item.likesUserId)

    return {
      ...item,
      likesUserIcon: user.user_icon
    }
  }))

  res.status(200).json({ status: 1, errmsg: '', data: data })

})

//message评论列表
app.get('/api/message/commentList', async (req, res) => {
  //获取token
  const token = req.cookies.access_token;
  if (!token) return res.status(200).json({ status: 0, errmsg: '请登录系统', data: '' })
  let user_id

  jwt.verify(token, 'jwtkey', async (err, userInfo) => {
    if (err) return res.status(200).json({ status: 0, errmsg: err, data: '' })
    user_id = userInfo.id
  })


  const articles = await Article.findAll({ where: { user_id: user_id } })
  const tempArticles = articles.map(item => item.dataValues)
  const tempData = await Promise.all(tempArticles.map(async item => {
    const comment = await Comment.findOne({ where: { article_id: item.id } })

    if (comment === null) {
      return item
    }
    else {
      return {
        ...item,
        comment_id: comment.id,
        create_comment_user_id: comment.user_id,
        comment_content: comment.content,
        comment_create_date: comment.updatedAt
      }
    }

  }))

  let data
  data = tempData.filter(item => item.comment_id)
  data = await Promise.all(data.map(async item => {
    const user = await User.findByPk(item.create_comment_user_id)

    return {
      ...item,
      comment_user_icon: user.user_icon,
      create_comment_username: user.username,
    }
  }))

  res.status(200).json({ status: 1, errmsg: '', data: data })

})

//获取用户信息
app.get('/api/userCenter/userInfo', async (req, res) => {
  const { id } = req.query

  //获取token
  const token = req.cookies.access_token;
  let current_user_id
  jwt.verify(token, 'jwtkey', function (err, userInfo) {
    current_user_id = userInfo.id
  })

  const user = await User.findByPk(id)
  if(user === null) return res.status(200).json({ status: 0, errmsg: '查询不到用户', data:'', })
  let countLook = 0
  let countLike = 0
  let countComment = 0
  let countCollect= 0
  let countReply = 0
  const articles = await Article.findAll({ where: { user_id: id } })
  const tempArticles = articles.map(item => item.dataValues)
  

  await Promise.all(tempArticles.map(async item => {
    countLook += item.count
    countLike += item.likes
    countComment += item.comment_count
    countCollect += item.collects
    countReply += await Reply.count({ where: { article_id: item.id } })
  }))
  
  const { ...other } = user.dataValues
  delete other.password

  return res.status(200).json({ 
    status: 1, 
    errmsg: '', 
    data: {
      ...other,
      countLook,
      countLike,
      countComment,
      countCollect,
      countReply,
      countArticle: articles.length || 0,
      isMine: current_user_id === id ? true : false
    }
  })
})

//修改用户信息
app.post('/api/user/updataUserInfo', async (req, res) => {
  const {
    id,
    username,
    introduction,
    email,
    posts,
    company,
  } = req.body

  const user = await User.findByPk(id)
  user.set({
    username,
    introduction,
    email,
    posts,
    company,
  })
  const updataUser = await user.save()
  if (!updataUser) return res.status(200).json({ status: 0, errmsg: '修改失败，服务器出错', data: '' })
  return res.status(200).json({ status: 1, errmsg: '', data: '修改成功' })
})
//修改用户密码
app.post('/api/user/updataUserPassword', async (req, res) => {
  const {
    id,
    current_password,
    new_password
  } = req.body

  const user = await User.findByPk(id)
  // 密码hash比对
  const isTruePassword = bcrypt.compareSync(current_password, user.password)
  if (!isTruePassword) return res.status(200).json({ status: 0, errmsg: '密码错误', data: '' })


  //密码转hash自动加盐
  const salt = bcrypt.genSaltSync(10);
  const hashPassword = bcrypt.hashSync(new_password, salt);
  user.password = hashPassword
  const updataUser = await user.save()
  if (!updataUser) return res.status(200).json({ status: 0, errmsg: '密码修改失败，服务器出错', data: '' })
  return res.status(200).json({ status: 1, errmsg: '', data: '密码修改成功' })
})

//启动一个服务并监听从 3000端口进入的所有连接请求
app.listen(PORT, function () {
  console.log('服务器开启成功');
});