import { AppError } from '@errors/AppError.js'

export class FirstNameRequiredError extends AppError {
  constructor() {
    super('First name is required')
  }
}

export class LastNameRequiredError extends AppError {
  constructor() {
    super('Last name is required')
  }
}

export class PasswordHashRequiredError extends AppError {
  constructor() {
    super('Password hash is required')
  }
}

export class InvalidRoleError extends AppError {
  constructor(message?: string) {
    super(message ?? 'Invalid role')
  }
}

export class InvalidEmailError extends AppError {
  constructor() {
    super('Invalid email format')
  }
}

export class InvalidCredentialsError extends AppError {
  constructor() {
    super('Invalid credentials')
  }
}

export class DuplicatedEmailError extends AppError {
  constructor() {
    super('Email is already in use')
  }
}

export class EmployeeNotFoundError extends AppError {
  constructor() {
    super('Employee not found')
  }
}

export class RestaurantNameRequiredError extends AppError {
  constructor() {
    super('Restaurant name is required')
  }
}

export class RestaurantAddressRequiredError extends AppError {
  constructor() {
    super('Restaurant address is required')
  }
}

export class RestaurantEmailRequiredError extends AppError {
  constructor() {
    super('Restaurant email is required')
  }
}

export class RestaurantNotFoundError extends AppError {
  constructor() {
    super('Restaurant not found')
  }
}

export class InvalidPhoneError extends AppError {
  constructor() {
    super('Invalid phone format')
  }
}

export class OwnerFirstNameRequiredError extends AppError {
  constructor() {
    super('Owner first name is required')
  }
}

export class OwnerLastNameRequiredError extends AppError {
  constructor() {
    super('Owner last name is required')
  }
}

export class IngredientNameRequiredError extends AppError {
  constructor() {
    super('Ingredient name is required')
  }
}

export class IngredientNotFoundError extends AppError {
  constructor() {
    super('Ingredient not found')
  }
}

export class InvalidUnitError extends AppError {
  constructor(message?: string) {
    super(message ?? 'Invalid unit')
  }
}

export class NegativeStockError extends AppError {
  constructor() {
    super('Stock cannot be negative')
  }
}

export class RestaurantIdRequiredError extends AppError {
  constructor() {
    super('Restaurant ID is required')
  }
}

export class DishNameRequiredError extends AppError {
  constructor() {
    super('Dish name is required')
  }
}

export class InvalidPriceError extends AppError {
  constructor() {
    super('Price must be a positive number')
  }
}

export class InvalidCategoryError extends AppError {
  constructor(message?: string) {
    super(message ?? 'Invalid category')
  }
}

export class DishNotFoundError extends AppError {
  constructor() {
    super('Dish not found')
  }
}

export class DatabaseNotInitializedError extends AppError {
  constructor() {
    super('Database is not initialized. Call dbConfig.initialize() first.')
  }
}

export class InvalidOrderStatusError extends AppError {
  constructor(message?: string) {
    super(message ?? 'Invalid order status')
  }
}

export class OrderNotFoundError extends AppError {
  constructor() {
    super('Order not found')
  }
}

export class InvalidTableStatusError extends AppError {
  constructor(message?: string) {
    super(message ?? 'Estado de mesa inválido')
  }
}

export class TableNotFoundError extends AppError {
  constructor() {
    super('Mesa no encontrada')
  }
}

export class InvalidTableNumberError extends AppError {
  constructor() {
    super('El número de mesa debe ser un entero mayor o igual que 1')
  }
}

export class InvalidTableCapacityError extends AppError {
  constructor() {
    super('La capacidad de la mesa debe ser un entero mayor o igual que 1')
  }
}

export class InvalidTableDescriptionError extends AppError {
  constructor() {
    super('La descripción de la mesa debe ser un texto')
  }
}

export class DuplicatedTableNumberError extends AppError {
  constructor() {
    super('Ya existe una mesa con ese número en el restaurante')
  }
}

export class TableOccupiedError extends AppError {
  constructor() {
    super('No se puede borrar una mesa ocupada')
  }
}

export class TableNotAvailableError extends AppError {
  constructor() {
    super('La mesa no está libre')
  }
}

export class InvalidPeopleCountError extends AppError {
  constructor() {
    super('El número de personas debe ser un entero mayor o igual que 1')
  }
}

export class TableCapacityExceededError extends AppError {
  constructor() {
    super('El número de personas supera la capacidad de la mesa')
  }
}

export class ForbiddenError extends AppError {
  constructor() {
    super('Forbidden: Insufficient permissions')
  }
}
