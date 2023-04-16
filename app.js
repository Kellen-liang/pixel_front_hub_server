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
const { User, Article, LikeCollectCount } = require('./entity/entity.js')

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
  const token = jwt.sign({ id: user.id, username: username }, "jwtkey")
  const { ...other } = user.dataValues
  delete other.password

  res
    .cookie("access_token", token, {
      httpOnly: true,
    })
    .status(200)
    .json({ status: 1, errmsg: '', data: other })
})

app.post('/api/user/logout', async (req, res) => {


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

  //获取token
  const token = req.cookies.access_token;
  let user_id, username
  jwt.verify(token, 'jwtkey', function (err, userInfo) {
    user_id = userInfo.id
    username = userInfo.username
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
        await Article.findAll({...setting})
      total = await Article.count()
      console.log(0);
      break
  }

  if (articels === null) {
    return res.status(200).json({ status: 0, errmsg: '服务器出错', data: '' })
  }

  console.log('articels', articels);

  const handleList = articels.map(item => item.dataValues)
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

    return {
      ...item,
      is_like: like ? true : false,
      is_collect: collect ? true : false
    }

  }))


  return res.status(200).json({ status: 1, errmsg: '', data: articelList, total, page, pageSize })
})

//查询指定文章
app.get('/api/article/getArticle_id', async (req, res) => {
  const { id } = req.query

  //获取token
  const token = req.cookies.access_token;
  let user_id, username
  jwt.verify(token, 'jwtkey', function (err, userInfo) {
    user_id = userInfo.id
    username = userInfo.username
  })

  const article = await Article.findByPk(id)

  if (article === null) {
    return res.status(200).json({ status: 0, errmsg: '服务器出错', data: '' })
  }

  console.log('article', article);

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


  return res.status(200).json({
    status: 1,
    errmsg: '',
    data: {
      ...article,
      is_like: like ? true : false,
      is_collect: collect ? true : false
    },
    total,
    page,
    pageSize
  })
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

//查询点赞/收藏列表
app.get('/api/likeCollectCount/search', async (req, res) => {
  //获取token
  const token = req.cookies.access_token;
  if (!token) return res.status(200).json({ status: 0, errmsg: '请登录系统', data: '' })

  jwt.verify(token, 'jwtkey', async (err, userInfo) => {
    if (err) return res.status(200).json({ status: 0, errmsg: err, data: '' })

    const dataList = await LikeCollectCount.findAll({ where: { user_id: userInfo.id } }) || []
    if (!dataList.length) return res.status(200).json({ status: 1, errmsg: '', data: [] })
    const handleList = dataList.map(item => item.dataValues)

    const newDataList = await Promise.all(handleList.map(async item => {
      const article = await Article.findByPk(item.article_id) || {}
      const articleCopy = _.cloneDeep(article.dataValues)
      delete articleCopy.id
      delete articleCopy.user_id
      delete articleCopy.username
      delete articleCopy.createdAt
      delete articleCopy.updatedAt

      return {
        ...item,
        ...articleCopy
      }
    }))

    return res.status(200).json({
      status: 1,
      errmsg: '',
      data: {
        likeList: newDataList.filter(item => item.like_id !== '') || [],
        collectList: newDataList.filter(item => item.collect_id !== '') || [],
      }
    })

  })
})

//查询指定文章

// app.get('/', async (req, res) => {

//     // console.log(User === sequelize.models.User); // true
//     const data = await User.findAll();
//     console.log(data)
//     res.send(data.map((item) => item.toJSON()));
//   // 这里是代码
// });


//启动一个服务并监听从 3000端口进入的所有连接请求
app.listen(PORT, function () {
  console.log('服务器开启成功');
});