const express = require('express');
const path = require('path')
const mysql = require('mysql2');
const { Client } = require('@elastic/elasticsearch');
// const { Console } = require('console');

const app = express();
const PORT = 3000;
const client = new Client({ node: 'http://localhost:9200' }); // Replace with your Elasticsearch URL

// MySQL database connection details
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'database_1'
});

// Connect to the MySQL database
// connection.connect();
connection.connect(err => {
  if (err) {
    console.error('Error connecting to MySQL database:', err);
    return;
  }
  console.log('Connected to MySQL database');
});


// Index Page
app.get('/',(req,res)=>{
    res.sendFile(path.join(__dirname,'index.html'));
})

app.get('/home', (req, res) => {
  connection.query('SELECT * FROM category_table', (err, results) => {
    if (err) {
      console.error('Error executing MySQL query:', err);
      res.status(500).send('Internal Server Error');
      return;
    }
    res.json(results);
  });
});


// Category Page
app.get('/category', (req, res) => {
  res.sendFile(path.join(__dirname, 'category-page.html'));
});
app.get('/category/type',  (req, res) => {
  var categoryId = req.query.id;
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  var startIndex = (page - 1) * limit;
  var endIndex = page * limit;  
  connection.query('SELECT * FROM product_table WHERE ID= ?',[categoryId], (err, data) => {
    var results = {};
    if(endIndex>=data.length){
      endIndex=data.length;
    } 
    if (endIndex <= data.length) {
      if (startIndex > 0) 
        results.prev = page-1;
      if (endIndex < data.length) 
        results.next = page + 1;
    }
    results.len=Math.ceil(data.length/10);
    results.results = data.slice(startIndex, endIndex);
    res.paginatedResults = results;
    res.json(res.paginatedResults);
  });
});


// All Products Page
app.get('/all-products', (req, res) => {
  res.sendFile(path.join(__dirname, 'all-products.html'));
});
app.get('/all-products/data', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    var startIndex = (page - 1)*10;
    var endIndex = page*10;  
  connection.query('SELECT * FROM product_table',(err,data) => {
      var results = {};
      if(endIndex>=data.length){
        endIndex=data.length;
      } 
      if (endIndex <= data.length) {
        if (startIndex >= 0) 
          results.prev = page-1;
        if (endIndex < data.length) 
          results.next = page + 1;
      }
      const uniqueCategories = [...new Set(data.map(data => data.category))];
      results.uniqueCategories=uniqueCategories;
      results.len=Math.ceil(data.length/10);
      results.results = data.slice(startIndex, endIndex);
      res.paginatedResults = results;
      res.json(res.paginatedResults);
    });
  }
  catch (err) {
    console.error('Error in /all-products route:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); 

app.get('/search', async (req, res) => {
  try {
    let searchItem = req.query.query || '';

    const regex = /\bunder\b\s*(\d+(\.\d+)?)?/i;
    searchItem = searchItem.replace(regex, '');

const body = await client.search({
  index: 'list_index',
  body: {
    query: {
      bool: {
        should: [
          {
            multi_match: {
              query: searchItem,
              fields: ['product_name', 'brand'],
            },
          },
          {
            bool: {
              must: [
                {
                  exists: {
                    field: 'mrp',
                  },
                },
                {
                  range: {
                    mrp: {
                      lte: parseInt(searchItem) || 0,
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    },
    _source: ['id', 'product_id', 'product_name', 'category', 'brand', 'mrp', 'discounted_price', 'stocks_remaining'],
  },
});

// ... (rest of the code)


    if (body.hits && body.hits.hits) {
      const hits = body.hits.hits;
      res.render('search', { data: hits });
    } else {
      console.error('No hits found in Elasticsearch response:', body);
      res.status(404).send('No data found');
    }
  } catch (error) {
    console.error('Error in Elasticsearch query:', error.message);
    res.status(500).send('Internal Server Error');
  }
});






// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});


