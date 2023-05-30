import { useState } from "react";
import axios from 'axios';
import {
  Card,
  Heading,
  TextContainer,
  Checkbox,
  DisplayText,
  TextStyle,
  ButtonGroup,
  Button,
  OptionList, 
  List,
  ProgressBar,
  Scrollable,
  Thumbnail
} from "@shopify/polaris";
import { Toast } from "@shopify/app-bridge-react";
import { useAppQuery, useAuthenticatedFetch } from "../hooks";

export function ProductsCard() {
  const [storeProducts, setStoreProducts] = useState([]);
  const [skuProducts, setSkuProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [updatedProducts, setUpdatedProducts] = useState([]);
  const [apiProgress, setApiProgress] = useState();
  const [apiImageProgress, setApiImageProgress] = useState();


  const emptyToastProps = { content: null };
  const [isLoading, setIsLoading] = useState(true);
  const [toastProps, setToastProps] = useState(emptyToastProps);
  const fetch = useAuthenticatedFetch();

  const {
    data,
    refetch: refetchProductCount,
    isLoading: isLoadingCount,
    isRefetching: isRefetchingCount,
  } = useAppQuery({
    url: "/api/products/count",
    reactQueryOptions: {
      onSuccess: () => {
        setIsLoading(false);
      },
    },
  });

  const toastMarkup = toastProps.content && !isRefetchingCount && (
    <Toast {...toastProps} onDismiss={() => setToastProps(emptyToastProps)} />
  );

  const handlePopulate = async () => {
    setIsLoading(true);
    const response = await fetch("/api/products/generate");

    if (response.ok) {
      await refetchProductCount();
      setToastProps({ content: "5 products created!" });
    } else {
      setIsLoading(false);
      setToastProps({
        content: "There was an error creating products",
        error: true,
      });
    }
  };

  const handleRetrieveProducts = async () => {
    
    let prodKey
    let prodTitle 
    let prodTitleSku 
    let variantTitle
    let variantSku

    const newProducts = []
    setIsLoading(true);
  
    const productsResponse = await fetch("/api/products");
    if (productsResponse.ok) {  
      const productData = await productsResponse.json();

      for (var i = 0; i < productData.length; i++) {
        for (var j = 0; j < productData[i].variants.length; j++) {
          
          // Get product ID from EN 
          // Get list of products sku's variants from ethical nutrient's dev site
          prodKey =  productData[i].id + [j]
          variantTitle = (productData[i].variants[j].title == "Default Title" ? "" : productData[i].variants[j].title )
          variantSku = productData[i].variants[j].sku
          variantSku = variantSku.indexOf("META_") >= 0 ? variantSku.substr(variantSku.indexOf("META_") + 5) : variantSku;

          prodTitle = productData[i].title +  " " + variantTitle
          prodTitleSku =  variantSku + " - " + prodTitle
          newProducts.push({value: prodKey, label: prodTitleSku, content: {prodTitle:prodTitle, id: productData[i].id, ean: variantSku}} )
        }      
      }
      setStoreProducts(newProducts)

      await refetchProductCount();
      setToastProps({ content: "Products retrieved!" });
    } else {
      setIsLoading(false);
      setToastProps({
        content: "There was an error retrieving products",
        error: true,
      });
    } 
  };

  const selectAll = () =>{
    let newSelectedProducts = storeProducts.map(e => e.value)
    setSelectedProducts(newSelectedProducts)
  }
  
  const clearAll = () =>{
    setSelectedProducts([])
  }
  
  const saveToStore = async () =>{
    let currentProgress
    setApiImageProgress(5)
    for (let [i, p] of updatedProducts.entries()){
      const settings = {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(p)
      };
      const response = await fetch("/api/image/upload", settings);

      currentProgress = (100 / selectedProducts.length * (i+1))
      setApiImageProgress(currentProgress)
    }
  }


  const handleUpdateStoreProducts = async () => {
    setApiProgress(1)

    const productsToUpdate = []

    let storeProduct
    let storeContent
    let storeProductId
    let storeVariantEan
    let currentProgress

    for (let p of selectedProducts){
      storeProduct = storeProducts.find(x => x.value === p)
      storeContent = storeProduct.content
      storeProductId = storeContent.id
      storeVariantEan = storeContent.ean

      productsToUpdate.push({
        key:storeProduct.value,
        id: storeProduct.content.id, 
        ean: storeProduct.content.ean, 
        label: storeContent.prodTitle,
      })
      
      // look for specific product in sku library
      // find FrontImage2D and BackImage images in sku library
      // update alt text of image to be the same as option values

      let currentPosition = productsToUpdate.length -1
      const response = await fetch(`/api/skulibrary/product?ean=${storeVariantEan}`);
      console.log("response " + storeVariantEan)
      const data = await response.json();
      console.log('Data -> ', data[0])

      productsToUpdate[currentPosition].images={
        frontImage2D: data[0].FrontImage2D,
        backImage: data[0].BackImage,
        size: data[0].Size
      }
  
      currentProgress = (100 / selectedProducts.length * productsToUpdate.length)
      setApiProgress(currentProgress)
    }
    setUpdatedProducts(productsToUpdate)

    setApiProgress(100)

    console.log("selected", selectedProducts)
    console.log("productsToUpdate", productsToUpdate)
    console.log("updatedProducts", updatedProducts)
    
  }


  return (
    <>
      {toastMarkup}
      <Card
        title="API Image Updater"
        sectioned
        primaryFooterAction={{
          content: "Get store products",
          onAction: handleRetrieveProducts,
          loading: isLoading,
        }}
      >
        <TextContainer spacing="loose">
          <p>
            1. Click to display the available products in your store. <br />
          </p>
        </TextContainer>
      </Card>

      <Card sectioned>
        <TextContainer spacing="loose">
          <Heading element="h4">
            Products in Store: {isLoadingCount ? "-" : data.count}
          </Heading>
          <p>
            2. Select the products you want to update. <br />
            (The variant id of each product should be the same as the SKU library EAN)<br />
          </p>
        </TextContainer>

        <br/>
        <ButtonGroup>
          <Button onClick={selectAll} outline monochrome enabled>
            Select all
          </Button>
          <span style={{color: '#bf0711'}}>
            <Button onClick ={clearAll} outline monochrome enabled>
              Clear selection
            </Button>
          </span>
        </ButtonGroup>

        <br/>
        <Scrollable shadow style={{height: '300px'}} focusable>
        <OptionList
          onChange={setSelectedProducts}
          selected={selectedProducts}
          options= {storeProducts}
          allowMultiple
          />
        <br/> 
        </Scrollable>
      </Card>

      <Card
        sectioned
      >
        <TextContainer spacing="loose">
          <p>
            3. Click to display the images of the selected products from the remote API. 
          </p>
          <br />
        </TextContainer>
        <Button primary onClick={handleUpdateStoreProducts} enabled>
          Load Images
        </Button>
        <br />
        <br />
        <ProgressBar progress={apiProgress} />
        <br/> 
        <Scrollable shadow style={{height: '400px'}} focusable>
          <List
            type="number" 
            children={updatedProducts.map(p => 
              <div key={p.key}>
              <List.Item key={p.key}> {p.label} 
                  <br/>
                  <div style={{display: 'flex', 'marginTop': "10px"}}>
                      <Thumbnail
                        source={p.images.frontImage2D}
                        alt={`Front ${p.images.size}`}
                        size="large"
                        />
                      <Thumbnail
                        source={p.images.backImage}
                        alt={`Back ${p.images.size}`}
                        size="large"
                        />
                  </div>
              </List.Item>
              <br/>
              </div>
            )}
          />
        </Scrollable>
      </Card>

      <Card
        sectioned
      >
        <TextContainer spacing="loose">
          <p>
            4. Images will be named the same as in SKU library. <br />
            They will receive their variant / size as 'alt' property.<br />
          </p>
        </TextContainer>
        <br />
        <Button primary onClick={saveToStore} enabled>
          Save / Update store images
        </Button>
        <br />
        <br />
        <ProgressBar progress={apiImageProgress} />
        <br/> 
      </Card>
      <br/> 
      <br/> 
      <br/> 
    </>
  );
}
