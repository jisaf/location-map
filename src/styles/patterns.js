const legendStyles = `
  .large-metro-pattern {
    background-image: linear-gradient(45deg, #000 25%, transparent 25%),
                      linear-gradient(-45deg, #000 25%, transparent 25%),
                      linear-gradient(transparent 50%, #000 50%);
    background-size: 4px 4px;
  }
  
  .metro-pattern {
    background-image: linear-gradient(45deg, #000 25%, transparent 25%),
                      linear-gradient(-45deg, #000 25%, transparent 25%);
    background-size: 4px 4px;
  }
  
  .micro-pattern {
    background-image: linear-gradient(0deg, #000 1px, transparent 1px),
                      linear-gradient(90deg, #000 1px, transparent 1px);
    background-size: 4px 4px;
  }
  
  .rural-pattern {
    background-image: linear-gradient(0deg, #000 1px, transparent 1px);
    background-size: 4px 4px;
  }
  
  .ceac-pattern {
    background-image: linear-gradient(45deg, #000 1px, transparent 1px);
    background-size: 4px 4px;
  }
`;

// Add styles to document head
const styleSheet = document.createElement('style');
styleSheet.type = 'text/css';
styleSheet.innerText = legendStyles;
document.head.appendChild(styleSheet);