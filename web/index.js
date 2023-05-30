// @ts-check
import { join } from 'path';
import { readFileSync } from 'fs';
import express from 'express';
import serveStatic from 'serve-static';

import shopify from './shopify.js';
import productCreator from './product-creator.js';
import GDPRWebhookHandlers from './gdpr.js';

import { LATEST_API_VERSION } from '@shopify/shopify-api';
import axios from 'axios';

const PORT = parseInt(process.env.BACKEND_PORT || process.env.PORT, 10);
const METAGENICS_API = process.env.METAGENICS_API;

const STATIC_PATH =
  process.env.NODE_ENV === 'production'
    ? `${process.cwd()}/frontend/dist`
    : `${process.cwd()}/frontend/`;

const app = express();

// Set up Shopify authentication and webhook handling
app.get(shopify.config.auth.path, shopify.auth.begin());
app.get(
  shopify.config.auth.callbackPath,
  shopify.auth.callback(),
  shopify.redirectToShopifyOrAppRoot()
);
app.post(
  shopify.config.webhooks.path,
  shopify.processWebhooks({ webhookHandlers: GDPRWebhookHandlers })
);

// All endpoints after this point will require an active session
app.use('/api/*', shopify.validateAuthenticatedSession());

app.use(express.json());

app.get('/api/skulibrary/product', async (_req, res) => {
  let storeVariantEan = _req.query.ean;
  let myUrl = `https://api.skulibrary.com/skuproductwebservice/REST/v1/productsAttributesModifiedAfter?clientCode=All+Retailers&mode=full&clientToken=${METAGENICS_API}&dateFrom=08/07/2014&modifiedType=product&nameFormat=Formatted&ean=${storeVariantEan}&useproductchangetime=True`;
  const skuProduct = await axios.get(myUrl);

  res.send(skuProduct.data);
});

app.get('/api/products/', async (_req, res) => {
  const storeProducts = await shopify.api.rest.Product.all({
    session: res.locals.shopify.session,
  });
  res.send(storeProducts);
});

app.get('/api/products/count', async (_req, res) => {
  const countData = await shopify.api.rest.Product.count({
    session: res.locals.shopify.session,
  });
  res.status(200).send(countData);
});

app.get('/api/products/generate', async (_req, res) => {
  let status = 200;
  let error = null;

  try {
    await productCreator(res.locals.shopify.session);
  } catch (e) {
    console.log(`Failed to process products/create: ${e.message}`);
    status = 500;
    error = e.message;
  }
  res.status(status).send({ success: status === 200, error });
});

app.post('/api/image/upload', async (_req, res) => {
  let status = 200;
  let error = null;
  let imageUrl;
  let startIndex;
  let endIndex;

  const session = res.locals.shopify.session;

  try {
    let image = new shopify.api.rest.Image({ session: session });

    image.product_id = _req.body.id;
    image.alt = _req.body.images.size;

    imageUrl = _req.body.images.frontImage2D;
    image.src = imageUrl;
    endIndex = imageUrl.indexOf('.jpg');
    startIndex = imageUrl.lastIndexOf('/', endIndex) + 1;
    image.filename = imageUrl.substring(startIndex, endIndex);
    await image.save({
      update: true,
    });
  } catch (e) {
    console.log(`Failed to process products/create: ${e.message}`);
    status = 500;
    error = e.message;
  }

  try {
    let image = new shopify.api.rest.Image({ session: session });

    image.product_id = _req.body.id;
    image.alt = _req.body.images.size;

    imageUrl = _req.body.images.backImage;
    image.src = imageUrl;
    endIndex = imageUrl.indexOf('.jpg');
    startIndex = imageUrl.lastIndexOf('/', endIndex) + 1;
    image.filename = imageUrl.substring(startIndex, endIndex);
    await image.save({
      update: true,
    });
  } catch (e) {
    console.log(`Failed to process products/create: ${e.message}`);
    status = 500;
    error = e.message;
  }

  res.status(status).send({ success: status === 200, error });
});

app.post('/api/products/create', async (_req, res) => {
  let status = 200;
  let error = null;

  const session = res.locals.shopify.session;

  try {
    const product = new shopify.api.rest.Product({ session: session });

    product.title = 'Bone Builder with Vitamin D Test';
    product.body_html = JSON.stringify(_req.body);
    product.vendor = 'Ethical Nutrients';
    product.product_type = '';
    product.tags = [''];
    product.handle = 'bone-builder-with-vitamin-d';

    await product.save({
      update: true,
    });
  } catch (e) {
    console.log(`Failed to process products/create: ${e.message}`);
    status = 500;
    error = e.message;
  }

  res.status(status).send({ success: status === 200, error });
});

app.use(serveStatic(STATIC_PATH, { index: false }));

app.use('/*', shopify.ensureInstalledOnShop(), async (_req, res, _next) => {
  return res
    .status(200)
    .set('Content-Type', 'text/html')
    .send(readFileSync(join(STATIC_PATH, 'index.html')));
});

app.listen(PORT);
