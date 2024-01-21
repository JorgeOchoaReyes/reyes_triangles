const power = 3;
const n = 10;
let foundZero = false;

let stringResults = "";
let layers = {} as { [key: number]: string };
for (let i = 0; i < n; i++) {
  const number = i ** power;
  stringResults += number + " ";
}

layers[1] = stringResults;
let currentLayer = 2;


while (!foundZero) {
  const arrayOfNumbers = stringResults.trim().split(" ").map(Number);
  const newArrayOfNumbers = [];

  for (let i = 0; i < arrayOfNumbers.length; i++) {
    if (arrayOfNumbers[i] && arrayOfNumbers[i + 1]) {
      const difference = arrayOfNumbers[i + 1] - arrayOfNumbers[i];

      if (difference <= 0) {
        foundZero = true;
        break;
      }
      newArrayOfNumbers.push(difference);
    }
  }


  layers[currentLayer] = newArrayOfNumbers.join(" ");
  stringResults = newArrayOfNumbers.join(" ");

  currentLayer++;
}

Object.values(layers).map((i) => {
  console.log(i);
})





